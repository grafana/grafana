package resource

import (
	"context"
	"io"
	"log/slog"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type Broadcaster[T any] interface {
	Subscribe(ctx context.Context, name, resource string) (<-chan T, error)
	Unsubscribe(<-chan T)
}

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
			Name: "storage_server_broadcaster_subscribers",
			Help: "Current number of active broadcaster subscribers.",
		}, []string{"resource"}),
		SubscriptionsTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_broadcaster_subscriptions_total",
			Help: "Total number of broadcaster subscription attempts by result.",
		}, []string{"resource", "result"}),
		UnsubscriptionsTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_broadcaster_unsubscriptions_total",
			Help: "Total number of broadcaster unsubscriptions by reason.",
		}, []string{"resource", "reason"}),
		EventsReceivedTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_broadcaster_events_received_total",
			Help: "Total number of events received by the broadcaster.",
		}, []string{"resource"}),
		OverflowEventsTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_broadcaster_overflow_events_total",
			Help: "Total number of events appended to subscriber overflow buffers.",
		}, []string{"resource"}),
	}
}

// NewBroadcaster creates a broadcaster that fans out items received on input to
// all active subscribers. The caller owns the input channel and is responsible
// for closing it when no more data will be sent. The broadcaster terminates
// when either ctx is cancelled or input is closed.
//
// eventResourceFn extracts a resource label for an event entering the broadcaster.
func NewBroadcaster[T any](ctx context.Context, input <-chan T, metrics *BroadcasterMetrics, eventResourceFn func(T) string) Broadcaster[T] {
	return newBroadcasterWithSizes[T](ctx, input, watchChanSize, defaultOverflowCap, metrics, eventResourceFn, nil, nil)
}

// Initialization runs asynchronously before the event loop. It must establish
// capture without depending on the broadcaster consuming input.
type cacheInitializer[T any] func(context.Context) (cacheSeed[T], error)

// newBroadcasterWithSizes creates a broadcaster with configurable buffer sizes for testing.
func newBroadcasterWithSizes[T any](ctx context.Context, input <-chan T, subBufSize, ovfCap int, metrics *BroadcasterMetrics, eventResourceFn func(T) string, identity eventIdentity[T], initialize cacheInitializer[T]) *broadcaster[T] {
	if metrics == nil {
		metrics = newBroadcasterMetrics(nil)
	}
	b := &broadcaster[T]{
		ctx:             ctx,
		initialize:      initialize,
		initializeNext:  make(chan struct{}, 1),
		initAttempt:     &initializationAttempt{done: make(chan struct{})},
		cache:           newWatchCache(defaultCacheSize, identity),
		subscribe:       make(chan *subscribeRequest[T], internalChanSize),
		unsubscribe:     make(chan (<-chan T), internalChanSize),
		subs:            make(map[<-chan T]*subscription[T]),
		terminated:      make(chan struct{}),
		metrics:         metrics,
		eventResourceFn: eventResourceFn,
		watchBufSize:    subBufSize,
		overflowCap:     ovfCap,
	}
	if initialize == nil {
		close(b.initAttempt.done)
	}

	go b.stream(input)

	return b
}

type subscription[T any] struct {
	name     string
	resource string // metric label for subscriber-attributed metrics
	ch       chan T
	overflow []T // pending items when channel is full, nil when not overflowing
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
	initializeNext chan struct{}
	initMu         sync.Mutex
	initAttempt    *initializationAttempt

	// subscription management

	cache           watchCache[T]
	subscribe       chan *subscribeRequest[T]
	unsubscribe     chan (<-chan T)
	subs            map[<-chan T]*subscription[T]
	metrics         *BroadcasterMetrics
	eventResourceFn func(T) string
	submissionMu    sync.RWMutex // serializes enqueueing with shutdown's pending-subscription cleanup

	// configuration

	watchBufSize    int
	overflowCap     int
	lastOverflowLog time.Time
	overflowCount   int64 // overflow events since last log
}

func (b *broadcaster[T]) eventResource(item T) string {
	if b.eventResourceFn == nil {
		return "unknown"
	}
	return b.eventResourceFn(item)
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

	// defaultCacheSize is the ring buffer size for replaying recent events to new subscribers.
	defaultCacheSize = 500

	// watchChanSize is the per-subscriber event delivery channel buffer.
	// Must be larger than defaultCacheSize so that readInto never fills the
	// channel completely, leaving headroom for new events.
	watchChanSize = 1000

	// defaultOverflowCap is the maximum number of items in a subscriber's overflow
	// buffer before the subscriber is disconnected.
	defaultOverflowCap = 50_000

	// drainInterval controls how often the stream loop drains overflow buffers
	// during idle periods (no incoming events).
	drainInterval = 100 * time.Millisecond

	// overflowLogInterval rate-limits "overflow started" log messages.
	overflowLogInterval = 10 * time.Second
)

func (b *broadcaster[T]) Subscribe(ctx context.Context, name, resource string) (<-chan T, error) {
	sub := &subscription[T]{name: name, resource: resource, ch: make(chan T, b.watchBufSize)}
	// Generic subscriptions remain asynchronous; ctx only bounds enqueueing.
	if err := b.submit(ctx, &subscribeRequest[T]{sub: sub}); err != nil {
		return nil, err
	}
	return sub.ch, nil
}

func (b *broadcaster[T]) submit(ctx context.Context, req *subscribeRequest[T]) error {
	sub := req.sub
	b.submissionMu.RLock()
	defer b.submissionMu.RUnlock()
	// A select alone could enqueue after shutdown has drained the queue.
	select {
	case <-b.terminated:
		b.metrics.SubscriptionsTotal.WithLabelValues(sub.resource, subscriptionResultTerminated).Inc()
		return io.EOF
	default:
	}
	select {
	case <-ctx.Done():
		b.metrics.SubscriptionsTotal.WithLabelValues(sub.resource, subscriptionResultCtxCanceled).Inc()
		return ctx.Err()
	case <-b.terminated:
		b.metrics.SubscriptionsTotal.WithLabelValues(sub.resource, subscriptionResultTerminated).Inc()
		return io.EOF
	case b.subscribe <- req:
		return nil
	}
}

// subscribeWatch acknowledges replay capture and live registration in the same
// operation as floor validation. Generic subscribers retain their existing API.
func (b *broadcaster[T]) subscribeWatch(ctx context.Context, name, resource string, resume *watchResume) (<-chan T, error) {
	if err := b.ensureReady(ctx); err != nil {
		return nil, err
	}
	sub := &subscription[T]{name: name, resource: resource, ch: make(chan T, b.watchBufSize)}
	req := &subscribeRequest[T]{sub: sub, ctx: ctx, resume: resume, ack: make(chan error, 1)}
	if err := b.submit(ctx, req); err != nil {
		return nil, err
	}
	select {
	case <-ctx.Done():
		// Unsubscribe drains queued admissions before removing the subscriber,
		// including when cancellation wins the race with the acknowledgment.
		b.Unsubscribe(sub.ch)
		return nil, ctx.Err()
	case <-b.terminated:
		return nil, io.EOF
	case err := <-req.ack:
		if err != nil {
			return nil, err
		}
		if err := ctx.Err(); err != nil {
			b.Unsubscribe(sub.ch)
			return nil, err
		}
		return sub.ch, nil
	}
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
		case b.initializeNext <- struct{}{}:
		case <-b.terminated:
			return io.EOF
		}
	}
	return b.waitForInitialization(ctx, attempt)
}

func (b *broadcaster[T]) waitForInitialization(ctx context.Context, attempt *initializationAttempt) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-b.terminated:
		b.initMu.Lock()
		err := attempt.err
		b.initMu.Unlock()
		if err != nil {
			return err
		}
		return io.EOF
	case <-attempt.done:
		b.initMu.Lock()
		err := attempt.err
		b.initMu.Unlock()
		return err
	}
}

func (b *broadcaster[T]) finishInitialization(attempt *initializationAttempt, err error, fatal bool) {
	b.initMu.Lock()
	attempt.err = err
	attempt.fatal = fatal
	close(attempt.done)
	b.initMu.Unlock()
}

func (b *broadcaster[T]) installSeed(seed cacheSeed[T]) error {
	return b.cache.seed(seed)
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
// Nils the overflow slice when fully drained to release memory.
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
		// Generic subscribers may have received their channels while startup
		// was still pending. Close those too, including on initialization failure.
		b.submissionMu.Lock()
		for len(b.subscribe) > 0 {
			req := <-b.subscribe
			close(req.sub.ch)
			b.metrics.SubscriptionsTotal.WithLabelValues(req.sub.resource, subscriptionResultTerminated).Inc()
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
				err = b.installSeed(seed)
				fatal = err != nil
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
			case <-b.initializeNext:
				b.initMu.Lock()
				attempt = b.initAttempt
				b.initMu.Unlock()
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
			b.metrics.EventsReceivedTotal.WithLabelValues(b.eventResource(item)).Inc()
			b.cache.add(item)

			var slow []<-chan T
			for _, sub := range b.subs {
				b.drainOverflow(sub)

				if len(sub.overflow) > 0 {
					// Still overflowing — append to overflow
					sub.overflow = append(sub.overflow, item)
					b.metrics.OverflowEventsTotal.WithLabelValues(sub.resource).Inc()
					b.overflowCount++
					if len(sub.overflow) > b.overflowCap {
						slog.Warn("disconnecting subscriber: overflow cap exceeded",
							"subscriber", sub.name,
							"overflowSize", len(sub.overflow))
						slow = append(slow, sub.ch)
					}
				} else {
					// Try direct send
					select {
					case sub.ch <- item:
					default:
						sub.overflow = append(sub.overflow, item)
						b.metrics.OverflowEventsTotal.WithLabelValues(sub.resource).Inc()
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
				}
			}
			// Instead of sending subscribers to b.unsubscribe channel, we unsubscribe directly.
			// Sending to b.unsubscribe could lead to deadlock, if there are too many elements in the
			// channel buffer already.
			for _, recv := range slow {
				b.removeSubscriber(recv, unsubscriptionReasonOverflowCap)
			}

		case <-drainTicker.C: // periodically drain overflow for idle periods
			for _, sub := range b.subs {
				b.drainOverflow(sub)
			}
		}
	}
}

// addSubscriber runs only on the stream goroutine so floor validation, replay,
// and registration remain atomic with respect to cache eviction.
func (b *broadcaster[T]) addSubscriber(req *subscribeRequest[T]) {
	sub := req.sub
	reject := func(err error, result string) {
		b.metrics.SubscriptionsTotal.WithLabelValues(sub.resource, result).Inc()
		close(sub.ch)
		if req.ack != nil {
			req.ack <- err
		}
	}
	if req.ctx != nil && req.ctx.Err() != nil {
		reject(req.ctx.Err(), subscriptionResultCtxCanceled)
		return
	}
	if req.resume != nil {
		if err := b.cache.validateResume(*req.resume); err != nil {
			result := subscriptionResultReplayFailed
			if IsResourceVersionExpired(err) {
				result = subscriptionResultExpired
			}
			reject(err, result)
			return
		}
	}
	// send initial batch of cached items
	if err := b.cache.replay(sub.ch); err != nil {
		reject(err, subscriptionResultReplayFailed)
		return
	}
	b.subs[sub.ch] = sub
	b.metrics.SubscriptionsTotal.WithLabelValues(sub.resource, subscriptionResultOK).Inc()
	b.metrics.Subscribers.WithLabelValues(sub.resource).Inc()
	if req.ack != nil {
		req.ack <- nil
	}
}

func (b *broadcaster[T]) removeSubscriber(recv <-chan T, reason string) {
	sub, ok := b.subs[recv]
	if !ok {
		return
	}
	sub.overflow = nil
	delete(b.subs, recv)
	b.metrics.Subscribers.WithLabelValues(sub.resource).Dec()
	b.metrics.UnsubscriptionsTotal.WithLabelValues(sub.resource, reason).Inc()
	close(sub.ch)
}

// ringBuffer is a fixed-size circular buffer. It is not safe for concurrent
// use — the broadcaster's single stream() goroutine is the only caller.
type ringBuffer[T any] struct {
	buf  []T
	zero int // index of the oldest item
	len  int // number of items currently stored
}

func newRingBuffer[T any](size int) ringBuffer[T] {
	if size <= 0 {
		size = defaultCacheSize
	}
	return ringBuffer[T]{
		buf: make([]T, size),
	}
}

func (r *ringBuffer[T]) add(item T) (evicted T, ok bool) {
	i := (r.zero + r.len) % len(r.buf)
	if r.len == len(r.buf) {
		evicted, ok = r.buf[i], true
	}
	r.buf[i] = item
	if r.len < len(r.buf) {
		r.len++
	} else {
		r.zero = (r.zero + 1) % len(r.buf)
	}
	return evicted, ok
}

// readInto sends all cached items to dst without blocking. Returns true if all
// items were sent, false if dst's buffer was full (slow consumer).
func (r *ringBuffer[T]) readInto(dst chan<- T) bool {
	for i := 0; i < r.len; i++ {
		select {
		case dst <- r.buf[(r.zero+i)%len(r.buf)]:
		default:
			return false
		}
	}
	return true
}
