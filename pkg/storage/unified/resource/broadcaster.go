package resource

import (
	"context"
	"io"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type BroadcasterMetrics struct {
	Subscribers          *prometheus.GaugeVec
	SubscriptionsTotal   *prometheus.CounterVec
	UnsubscriptionsTotal *prometheus.CounterVec
	EventsReceivedTotal  *prometheus.CounterVec
	OverflowEventsTotal  *prometheus.CounterVec
}

func newBroadcasterMetrics(reg prometheus.Registerer) *BroadcasterMetrics {
	return &BroadcasterMetrics{
		Subscribers: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Name: "grafana_storage_server_broadcaster_subscribers",
			Help: "Current number of active broadcaster subscribers.",
		}, []string{"resource"}),
		SubscriptionsTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_broadcaster_subscriptions_total",
			Help: "Total number of broadcaster subscription attempts by result.",
		}, []string{"resource", "result"}),
		UnsubscriptionsTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_broadcaster_unsubscriptions_total",
			Help: "Total number of broadcaster unsubscriptions by reason.",
		}, []string{"resource", "reason"}),
		EventsReceivedTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_broadcaster_events_received_total",
			Help: "Total number of events received by the broadcaster.",
		}, []string{"resource"}),
		OverflowEventsTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_storage_server_broadcaster_overflow_events_total",
			Help: "Total number of events appended to subscriber overflow buffers.",
		}, []string{"resource"}),
	}
}

// newBroadcaster creates a broadcaster that fans out items received on input to
// watchers of each item's collection. The caller owns the input channel and is
// responsible for closing it when no more data will be sent. The broadcaster
// terminates when either ctx is cancelled or input is closed.
//
// identity routes items to watchers of their collection and labels metrics.
func newBroadcaster[T any](ctx context.Context, input <-chan T, metrics *BroadcasterMetrics, identity eventIdentity[T]) *broadcaster[T] {
	return newBroadcasterWithSizes(ctx, input, watchChanSize, defaultOverflowCap, metrics, identity, nil)
}

// Initialization runs asynchronously before the event loop. It must establish
// capture without depending on the broadcaster consuming input.
type cacheInitializer[T any] func(context.Context) (cacheSeed[T], error)

type seededCacheConfig[T any] struct {
	initialize cacheInitializer[T]
	raised     *raisedFloors
}

// newBroadcasterWithSizes creates a broadcaster with configurable buffer sizes for testing.
func newBroadcasterWithSizes[T any](ctx context.Context, input <-chan T, subBufSize, ovfCap int, metrics *BroadcasterMetrics, identity eventIdentity[T], seeded *seededCacheConfig[T]) *broadcaster[T] {
	if metrics == nil {
		metrics = newBroadcasterMetrics(nil)
	}
	var initialize cacheInitializer[T]
	var raised *raisedFloors
	if seeded != nil {
		initialize = seeded.initialize
		raised = seeded.raised
	}
	b := &broadcaster[T]{
		ctx:            ctx,
		initialize:     initialize,
		initializeNext: make(chan *initializationAttempt, 1),
		initAttempt:    &initializationAttempt{done: make(chan struct{})},
		cache:          newWatchCache(defaultCacheSize, identity),
		subscribe:      make(chan *subscribeRequest[T], internalChanSize),
		unsubscribe:    make(chan (<-chan T), internalChanSize),
		subs:           make(map[<-chan T]*subscription[T]),
		scoped:         make(map[GroupResource]*collectionSubscribers[T]),
		overflowing:    make(map[<-chan T]*subscription[T]),
		terminated:     make(chan struct{}),
		metrics:        metrics,
		watchBufSize:   subBufSize,
		overflowCap:    ovfCap,
	}
	b.cache.raised = raised
	if initialize == nil {
		close(b.initAttempt.done)
	}

	go b.stream(input)

	return b
}

// collectionSubscribers indexes a collection's subscribers by namespace, so
// an event only reaches watches of its namespace and of all namespaces.
type collectionSubscribers[T any] struct {
	all         map[<-chan T]*subscription[T]
	byNamespace map[string]map[<-chan T]*subscription[T]
	// received is the highest RV delivered in the collection, published after
	// delivery like broadcaster.received.
	received atomic.Int64
}

func (c *collectionSubscribers[T]) bucket(namespace string) map[<-chan T]*subscription[T] {
	if namespace == "" {
		return c.all
	}
	return c.byNamespace[namespace]
}

type subscription[T any] struct {
	name      string
	gr        GroupResource // also the metric label for subscriber-attributed metrics
	namespace string        // empty to receive every namespace
	// collection is the index the subscriber is registered in.
	collection *collectionSubscribers[T]
	ch         chan T
	overflow   []T // pending items when channel is full, nil when not overflowing
	// delivered counts events handed to the subscriber, through ch or overflow.
	// Its watch reads it to tell whether it has consumed them all.
	delivered atomic.Int64
	removed   atomic.Bool
	// startRV is the broadcaster's received watermark when the subscriber was
	// registered. Events up to it were not all replayed to the subscriber, so
	// they cannot establish its progress.
	startRV int64
	// collectionStartRV is the collection's received watermark at registration.
	collectionStartRV int64
}

type subscribeRequest[T any] struct {
	sub    *subscription[T]
	ctx    context.Context
	resume *watchResume
	ack    chan error
}

type initializationAttempt struct {
	done  chan struct{}
	err   error
	fatal bool
}

type broadcaster[T any] struct {
	// lifecycle management

	ctx            context.Context
	terminated     chan struct{}
	initialize     cacheInitializer[T]
	initializeNext chan *initializationAttempt
	initMu         sync.Mutex
	initAttempt    *initializationAttempt

	// subscription management

	cache        watchCache[T]
	subscribe    chan *subscribeRequest[T]
	unsubscribe  chan (<-chan T)
	received     atomic.Int64 // cache.maxRV, published once delivered
	subs         map[<-chan T]*subscription[T]
	scoped       map[GroupResource]*collectionSubscribers[T]
	overflowing  map[<-chan T]*subscription[T] // subscriptions with pending overflow
	metrics      *BroadcasterMetrics
	submissionMu sync.RWMutex // serializes enqueueing with shutdown's pending-subscription cleanup

	// configuration

	watchBufSize    int
	overflowCap     int
	lastOverflowLog time.Time
	overflowCount   int64 // overflow events since last log
}

const (
	subscriptionResultOK           = "ok"
	subscriptionResultCtxCanceled  = "ctx_canceled"
	subscriptionResultTerminated   = "terminated"
	subscriptionResultReplayFailed = "replay_failed"
	subscriptionResultExpired      = "expired"

	unsubscriptionReasonClient      = "client"
	unsubscriptionReasonOverflowCap = "overflow_cap"
	unsubscriptionReasonShutdown    = "shutdown"
)

const (
	// internalChanSize is the buffer for internal subscribe/unsubscribe coordination channels.
	internalChanSize = 100

	// defaultCacheSize limits the replay history retained per collection.
	defaultCacheSize = 500

	// defaultCacheMaxBytes bounds retained event memory independently of event count.
	defaultCacheMaxBytes = 100 * 1024 * 1024

	// defaultCacheMaxEvents bounds the events cached across all collections,
	// each of which keeps up to defaultCacheSize.
	defaultCacheMaxEvents = 10 * defaultCacheSize

	// watchChanSize is the per-subscriber event delivery channel buffer.
	// Must be larger than defaultCacheSize so replay leaves room for live events.
	watchChanSize = 1000

	// defaultOverflowCap is the maximum number of items in a subscriber's overflow
	// buffer before the subscriber is disconnected.
	defaultOverflowCap = 50_000

	// drainInterval lets subscriptions with no matching writes drain their overflow.
	drainInterval = 100 * time.Millisecond

	// overflowLogInterval rate-limits "overflow started" log messages.
	overflowLogInterval = 10 * time.Second
)

func (b *broadcaster[T]) submit(req *subscribeRequest[T]) error {
	sub := req.sub
	b.submissionMu.RLock()
	defer b.submissionMu.RUnlock()
	// A select alone could enqueue after shutdown has drained the queue.
	select {
	case <-b.terminated:
		b.metrics.SubscriptionsTotal.WithLabelValues(sub.gr.Resource, subscriptionResultTerminated).Inc()
		return io.EOF
	default:
	}
	select {
	case <-req.ctx.Done():
		b.metrics.SubscriptionsTotal.WithLabelValues(sub.gr.Resource, subscriptionResultCtxCanceled).Inc()
		return req.ctx.Err()
	case <-b.terminated:
		b.metrics.SubscriptionsTotal.WithLabelValues(sub.gr.Resource, subscriptionResultTerminated).Inc()
		return io.EOF
	case b.subscribe <- req:
		return nil
	}
}

// subscribeWatch acknowledges replay capture and live registration in the same
// operation as floor validation. The subscriber only receives gr's events.
// A nil resume registers for live delivery only.
func (b *broadcaster[T]) subscribeWatch(ctx context.Context, name string, gr GroupResource, namespace string, resume *watchResume) (*watchSubscription[T], error) {
	if err := b.ensureReady(ctx); err != nil {
		return nil, err
	}
	sub := &subscription[T]{name: name, gr: gr, namespace: namespace, ch: make(chan T, b.watchBufSize)}
	req := &subscribeRequest[T]{sub: sub, ctx: ctx, resume: resume, ack: make(chan error, 1)}
	if err := b.submit(req); err != nil {
		return nil, err
	}
	select {
	case <-ctx.Done():
	case <-b.terminated:
		return nil, io.EOF
	case err := <-req.ack:
		if err != nil {
			return nil, err
		}
	}
	// Cancellation can race with acknowledgment. Unsubscribe drains queued
	// admissions before removing the subscriber.
	if err := ctx.Err(); err != nil {
		b.Unsubscribe(sub.ch)
		return nil, err
	}
	return &watchSubscription[T]{b: b, sub: sub}, nil
}

// ensureReady starts a new initialization attempt after a retryable failure.
// Concurrent callers share the same attempt, and canceling one caller does not
// cancel initialization for the others.
func (b *broadcaster[T]) ensureReady(ctx context.Context) error {
	b.initMu.Lock()
	attempt := b.initAttempt
	start := false
	select {
	case <-attempt.done:
		if attempt.err == nil || attempt.fatal {
			err := attempt.err
			b.initMu.Unlock()
			return err
		}
		start = true
	default:
	}
	if err := b.ctx.Err(); err != nil {
		b.initMu.Unlock()
		return err
	}
	if start {
		attempt = &initializationAttempt{done: make(chan struct{})}
		b.initAttempt = attempt
	}
	b.initMu.Unlock()

	if start {
		select {
		case b.initializeNext <- attempt:
		case <-b.terminated:
			return io.EOF
		}
	}
	return b.waitForInitialization(ctx, attempt)
}

// starting reports whether the cache has not been initialized yet.
func (b *broadcaster[T]) starting() bool {
	b.initMu.Lock()
	defer b.initMu.Unlock()
	select {
	case <-b.initAttempt.done:
		return b.initAttempt.err != nil
	default:
		return true
	}
}

func (b *broadcaster[T]) waitForInitialization(ctx context.Context, attempt *initializationAttempt) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-b.terminated:
		if attempt.err != nil {
			return attempt.err
		}
		return io.EOF
	case <-attempt.done:
		return attempt.err
	}
}

func (b *broadcaster[T]) finishInitialization(attempt *initializationAttempt, err error, fatal bool) {
	attempt.err = err
	attempt.fatal = fatal
	close(attempt.done)
}

type watchSubscription[T any] struct {
	b   *broadcaster[T]
	sub *subscription[T]
}

func (s *watchSubscription[T]) events() <-chan T {
	return s.sub.ch
}

// rv returns the highest RV the broadcaster has received once the watch has
// consumed every event delivered to it, or 0 while some are pending, before
// anything newer than the watch's start arrived, or after the subscription was
// removed. This stands in for the progress other collections' events used to
// carry; replayed and live events of its own collection still advance the
// watch directly.
func (s *watchSubscription[T]) rv(consumed int64) int64 {
	return s.progress(s.b.received.Load(), s.sub.startRV, consumed)
}

// collectionRV is like rv, from the events of the watch's own collection,
// including progress from other namespaces. A late write in another namespace
// below the registration watermark cannot advance the bookmark on its own.
func (s *watchSubscription[T]) collectionRV(consumed int64) int64 {
	return s.progress(s.sub.collection.received.Load(), s.sub.collectionStartRV, consumed)
}

func (s *watchSubscription[T]) progress(received, start, consumed int64) int64 {
	// received is published after delivery, so every event it covers is
	// already counted in delivered.
	if received <= start || s.sub.removed.Load() || s.sub.delivered.Load() != consumed {
		return 0
	}
	return received
}

func (b *broadcaster[T]) Unsubscribe(sub <-chan T) {
	if sub == nil {
		return
	}

	select {
	case b.unsubscribe <- sub: // success submitting unsubscription
	case <-b.terminated: // broadcaster terminated, nothing to do
	}
}

// drainOverflow moves items from sub.overflow into sub.ch without blocking.
// When the queue empties, it releases the buffer and clears the overflow index.
func (b *broadcaster[T]) drainOverflow(sub *subscription[T]) {
	if len(sub.overflow) == 0 {
		return
	}
	i := 0
	for i < len(sub.overflow) {
		select {
		case sub.ch <- sub.overflow[i]:
			i++
		default:
			sub.overflow = sub.overflow[i:]
			return
		}
	}
	sub.overflow = nil
	delete(b.overflowing, sub.ch)
}

// stream acts a message broker between the watch implementation that receives a
// raw stream of events and the individual clients watching for those events.
// Thus, we hold the receive side of the watch implementation, and we are
// limited here to receive from it, whereas we are responsible for sending to
// watchers and closing their channels. The responsibility of closing `input`
// (as with any other channel) will always be of the sending side. Hence, the
// watch implementation should do it.
func (b *broadcaster[T]) stream(input <-chan T) {
	// make sure we unconditionally cleanup upon return
	defer func() {
		// prevent new subscriptions and make sure to discard unsubscriptions
		close(b.terminated)
		// Close requests queued at shutdown; their callers return on termination.
		b.submissionMu.Lock()
		for len(b.subscribe) > 0 {
			req := <-b.subscribe
			close(req.sub.ch)
			b.metrics.SubscriptionsTotal.WithLabelValues(req.sub.gr.Resource, subscriptionResultTerminated).Inc()
		}
		b.submissionMu.Unlock()
		// terminate all subscriptions
		for recv := range b.subs {
			b.removeSubscriber(recv, unsubscriptionReasonShutdown)
		}
	}()

	if b.initialize != nil {
		ctx, cancel := context.WithCancel(b.ctx)
		defer cancel()
		attempt := b.initAttempt
		for {
			seed, err := b.initialize(ctx)
			fatal := false
			if err == nil {
				err = b.cache.seed(seed)
				fatal = err != nil
				b.received.Store(b.cache.maxRV)
			}
			b.finishInitialization(attempt, err, fatal)
			if err == nil {
				break
			}
			if fatal {
				return
			}

			select {
			case <-ctx.Done():
				return
			case attempt = <-b.initializeNext:
			}
		}
	}

	drainTicker := time.NewTicker(drainInterval)
	defer drainTicker.Stop()

	for {
		select {
		case <-b.ctx.Done(): // service context cancelled
			return

		case req := <-b.subscribe: // subscribe
			b.addSubscriber(req)

		case recv := <-b.unsubscribe: // unsubscribe
			// Drain pending subscribes so we don't miss one that was
			// buffered before this unsubscribe.
			for drained := false; !drained; {
				select {
				case req := <-b.subscribe:
					b.addSubscriber(req)
				default:
					drained = true
				}
			}
			b.removeSubscriber(recv, unsubscriptionReasonClient)

		case item, ok := <-input: // data arrived, send to subscribers
			// input closed, drain subscribers and exit
			if !ok {
				return
			}
			gr := b.cache.add(item)
			b.metrics.EventsReceivedTotal.WithLabelValues(gr.Resource).Inc()

			var slow []<-chan T
			if collection := b.scoped[gr]; collection != nil {
				deliver := func(subs map[<-chan T]*subscription[T]) {
					for _, sub := range subs {
						if !b.deliver(sub, item) {
							slow = append(slow, sub.ch)
						}
					}
				}
				_, namespace, rv := b.cache.identity(item)
				deliver(collection.all)
				deliver(collection.byNamespace[namespace])
				collection.received.Store(max(collection.received.Load(), rv))
			}
			// Instead of sending subscribers to b.unsubscribe channel, we unsubscribe directly.
			// Sending to b.unsubscribe could lead to deadlock, if there are too many elements in the
			// channel buffer already.
			for _, recv := range slow {
				b.removeSubscriber(recv, unsubscriptionReasonOverflowCap)
			}
			b.received.Store(b.cache.maxRV)

		case <-drainTicker.C:
			for _, sub := range b.overflowing {
				b.drainOverflow(sub)
			}
		}
	}
}

// deliver sends item to sub, spooling to its overflow buffer when the channel is
// full. It returns false when the overflow cap is exceeded.
func (b *broadcaster[T]) deliver(sub *subscription[T], item T) bool {
	sub.delivered.Add(1)
	b.drainOverflow(sub)

	if len(sub.overflow) > 0 {
		// Still overflowing — append to overflow
		sub.overflow = append(sub.overflow, item)
		b.metrics.OverflowEventsTotal.WithLabelValues(sub.gr.Resource).Inc()
		b.overflowCount++
		if len(sub.overflow) > b.overflowCap {
			slog.Warn("disconnecting subscriber: overflow cap exceeded",
				"subscriber", sub.name,
				"overflowSize", len(sub.overflow))
			return false
		}
		return true
	}
	// Try direct send
	select {
	case sub.ch <- item:
	default:
		sub.overflow = append(sub.overflow, item)
		b.overflowing[sub.ch] = sub
		b.metrics.OverflowEventsTotal.WithLabelValues(sub.gr.Resource).Inc()
		b.overflowCount++
		now := time.Now()
		if now.Sub(b.lastOverflowLog) > overflowLogInterval {
			slog.Warn("subscriber overflow",
				"subscriber", sub.name,
				"overflowSize", len(sub.overflow),
				"overflowsSinceLastLog", b.overflowCount)
			b.lastOverflowLog = now
			b.overflowCount = 0
		}
	}
	return true
}

// addSubscriber runs only on the stream goroutine so floor validation, replay,
// and registration remain atomic with respect to cache eviction.
func (b *broadcaster[T]) addSubscriber(req *subscribeRequest[T]) {
	sub := req.sub
	reject := func(err error, result string) {
		b.metrics.SubscriptionsTotal.WithLabelValues(sub.gr.Resource, result).Inc()
		close(sub.ch)
		req.ack <- err
	}
	if req.ctx.Err() != nil {
		reject(req.ctx.Err(), subscriptionResultCtxCanceled)
		return
	}
	if req.resume != nil {
		// Negative cursors predate resume floors and replay all retained events.
		if req.resume.requestedRV >= 0 {
			if err := b.cache.validateResume(sub.gr, *req.resume); err != nil {
				result := subscriptionResultReplayFailed
				if IsResourceVersionExpired(err) {
					result = subscriptionResultExpired
				}
				reject(err, result)
				return
			}
		}
		if err := b.cache.replay(sub.ch, sub.gr, req.resume.since); err != nil {
			reject(err, subscriptionResultReplayFailed)
			return
		}
		sub.delivered.Store(int64(len(sub.ch)))
	}
	sub.startRV = b.cache.maxRV
	b.subs[sub.ch] = sub
	collection := b.scoped[sub.gr]
	if collection == nil {
		collection = &collectionSubscribers[T]{
			all:         make(map[<-chan T]*subscription[T]),
			byNamespace: make(map[string]map[<-chan T]*subscription[T]),
		}
		b.scoped[sub.gr] = collection
	}
	bucket := collection.bucket(sub.namespace)
	if bucket == nil {
		bucket = make(map[<-chan T]*subscription[T])
		collection.byNamespace[sub.namespace] = bucket
	}
	bucket[sub.ch] = sub
	sub.collection = collection
	sub.collectionStartRV = collection.received.Load()
	b.metrics.SubscriptionsTotal.WithLabelValues(sub.gr.Resource, subscriptionResultOK).Inc()
	b.metrics.Subscribers.WithLabelValues(sub.gr.Resource).Inc()
	req.ack <- nil
}

func (b *broadcaster[T]) removeSubscriber(recv <-chan T, reason string) {
	sub, ok := b.subs[recv]
	if !ok {
		return
	}
	sub.overflow = nil
	delete(b.subs, recv)
	delete(b.overflowing, recv)
	sub.removed.Store(true)
	collection := sub.collection
	delete(collection.bucket(sub.namespace), recv)
	if sub.namespace != "" && len(collection.byNamespace[sub.namespace]) == 0 {
		delete(collection.byNamespace, sub.namespace)
	}
	if len(collection.all) == 0 && len(collection.byNamespace) == 0 {
		delete(b.scoped, sub.gr)
	}
	b.metrics.Subscribers.WithLabelValues(sub.gr.Resource).Dec()
	b.metrics.UnsubscriptionsTotal.WithLabelValues(sub.gr.Resource, reason).Inc()
	close(sub.ch)
}
