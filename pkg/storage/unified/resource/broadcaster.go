package resource

import (
	"context"
	"io"
	"log/slog"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type Broadcaster[T any] interface {
	Subscribe(ctx context.Context, name string) (<-chan T, error)
	Unsubscribe(<-chan T)
}

type BroadcasterMetrics struct {
	Subscribers          prometheus.Gauge
	SubscriptionsTotal   *prometheus.CounterVec
	UnsubscriptionsTotal *prometheus.CounterVec
	EventsReceivedTotal  prometheus.Counter
	OverflowEventsTotal  prometheus.Counter
}

func newBroadcasterMetrics(reg prometheus.Registerer) *BroadcasterMetrics {
	return &BroadcasterMetrics{
		Subscribers: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "storage_server_broadcaster_subscribers",
			Help: "Current number of active broadcaster subscribers.",
		}),
		SubscriptionsTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_broadcaster_subscriptions_total",
			Help: "Total number of broadcaster subscription attempts by result.",
		}, []string{"result"}),
		UnsubscriptionsTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "storage_server_broadcaster_unsubscriptions_total",
			Help: "Total number of broadcaster unsubscriptions by reason.",
		}, []string{"reason"}),
		EventsReceivedTotal: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "storage_server_broadcaster_events_received_total",
			Help: "Total number of events received by the broadcaster.",
		}),
		OverflowEventsTotal: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "storage_server_broadcaster_overflow_events_total",
			Help: "Total number of events appended to subscriber overflow buffers.",
		}),
	}
}

// NewBroadcaster creates a broadcaster that fans out items received on input to
// all active subscribers. The caller owns the input channel and is responsible
// for closing it when no more data will be sent. The broadcaster terminates
// when either ctx is cancelled or input is closed.
func NewBroadcaster[T any](ctx context.Context, input <-chan T, metrics *BroadcasterMetrics) Broadcaster[T] {
	return newBroadcasterWithSizes[T](ctx, input, watchChanSize, defaultOverflowCap, metrics)
}

// newBroadcasterWithSizes creates a broadcaster with configurable buffer sizes for testing.
func newBroadcasterWithSizes[T any](ctx context.Context, input <-chan T, subBufSize, ovfCap int, metrics *BroadcasterMetrics) *broadcaster[T] {
	if metrics == nil {
		metrics = newBroadcasterMetrics(nil)
	}
	b := &broadcaster[T]{
		shouldTerminate: ctx.Done(),
		cache:           newRingBuffer[T](defaultCacheSize),
		subscribe:       make(chan *subscription[T], internalChanSize),
		unsubscribe:     make(chan (<-chan T), internalChanSize),
		subs:            make(map[<-chan T]*subscription[T]),
		terminated:      make(chan struct{}),
		metrics:         metrics,
		watchBufSize:    subBufSize,
		overflowCap:     ovfCap,
	}

	go b.stream(input)

	return b
}

type subscription[T any] struct {
	name     string
	ch       chan T
	overflow []T // pending items when channel is full, nil when not overflowing
}

type broadcaster[T any] struct {
	// lifecycle management

	terminated      chan struct{}
	shouldTerminate <-chan struct{}

	// subscription management

	cache       ringBuffer[T]
	subscribe   chan *subscription[T]
	unsubscribe chan (<-chan T)
	subs        map[<-chan T]*subscription[T]
	metrics     *BroadcasterMetrics

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

func (b *broadcaster[T]) Subscribe(ctx context.Context, name string) (<-chan T, error) {
	sub := &subscription[T]{name: name, ch: make(chan T, b.watchBufSize)}

	select {
	case <-ctx.Done(): // client canceled
		b.metrics.SubscriptionsTotal.WithLabelValues(subscriptionResultCtxCanceled).Inc()
		return nil, ctx.Err()
	case <-b.terminated: // no more data
		b.metrics.SubscriptionsTotal.WithLabelValues(subscriptionResultTerminated).Inc()
		return nil, io.EOF
	case b.subscribe <- sub: // success submitting subscription
		return sub.ch, nil
	}
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
	drainTicker := time.NewTicker(drainInterval)
	defer drainTicker.Stop()

	// make sure we unconditionally cleanup upon return
	defer func() {
		// prevent new subscriptions and make sure to discard unsubscriptions
		close(b.terminated)
		// terminate all subscriptions
		for recv := range b.subs {
			b.removeSubscriber(recv, unsubscriptionReasonShutdown)
		}
	}()

	addSubscriber := func(sub *subscription[T]) {
		// send initial batch of cached items
		if !b.cache.readInto(sub.ch) {
			b.metrics.SubscriptionsTotal.WithLabelValues(subscriptionResultReplayFailed).Inc()
			close(sub.ch)
			return
		}
		b.subs[sub.ch] = sub
		b.metrics.SubscriptionsTotal.WithLabelValues(subscriptionResultOK).Inc()
		b.metrics.Subscribers.Inc()
	}

	for {
		select {
		case <-b.shouldTerminate: // service context cancelled
			return

		case sub := <-b.subscribe: // subscribe
			addSubscriber(sub)

		case recv := <-b.unsubscribe: // unsubscribe
			// Drain pending subscribes so we don't miss one that was
			// buffered before this unsubscribe.
			for drained := false; !drained; {
				select {
				case sub := <-b.subscribe:
					addSubscriber(sub)
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
			b.metrics.EventsReceivedTotal.Inc()
			b.cache.add(item)

			var slow []<-chan T
			for _, sub := range b.subs {
				b.drainOverflow(sub)

				if len(sub.overflow) > 0 {
					// Still overflowing — append to overflow
					sub.overflow = append(sub.overflow, item)
					b.metrics.OverflowEventsTotal.Inc()
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
						b.metrics.OverflowEventsTotal.Inc()
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

func (b *broadcaster[T]) removeSubscriber(recv <-chan T, reason string) {
	sub, ok := b.subs[recv]
	if !ok {
		return
	}
	sub.overflow = nil
	delete(b.subs, recv)
	b.metrics.Subscribers.Dec()
	b.metrics.UnsubscriptionsTotal.WithLabelValues(reason).Inc()
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

func (r *ringBuffer[T]) add(item T) {
	i := (r.zero + r.len) % len(r.buf)
	r.buf[i] = item
	if r.len < len(r.buf) {
		r.len++
	} else {
		r.zero = (r.zero + 1) % len(r.buf)
	}
}

// readInto sends all cached items to dst without blocking. Returns true if all
// items were sent, false if dst's buffer was full (slow consumer).
func (r *ringBuffer[T]) readInto(dst chan T) bool {
	for i := 0; i < r.len; i++ {
		select {
		case dst <- r.buf[(r.zero+i)%len(r.buf)]:
		default:
			return false
		}
	}
	return true
}
