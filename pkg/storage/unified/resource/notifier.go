package resource

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana-app-sdk/logging"
)

const (
	defaultSettleDelay = 3 * time.Second
	defaultMinBackoff  = 100 * time.Millisecond
	defaultMaxBackoff  = 5 * time.Second
	defaultBufferSize  = 10000
)

// EventWatcher streams change events as they happen.
type EventWatcher interface {
	// Watch returns a channel that will receive events as they happen.
	Watch(context.Context, WatchOptions) <-chan Event
}

type notifier interface {
	EventWatcher
	// Publish lets callers to inform watchers about events. Some notifiers
	// (e.g., channel notifier) require callers to provide the events to be published.
	// Others (e.g., polling notifier) queries events separately, making
	// publishing a no-op.
	Publish(Event)
}

var (
	_ notifier = (*pollingNotifier)(nil)
	_ notifier = (*channelNotifier)(nil)
	_ notifier = (*natsNotifier)(nil)
)

type pollingNotifier struct {
	eventStore *eventStore
	log        logging.Logger
}

type notifierOptions struct {
	log                logging.Logger
	useChannelNotifier bool

	enableNatsNotifier bool
	eventSubscriber    EventSubscriber
	natsDropped        *prometheus.CounterVec
	invalidator        Invalidator
}

type WatchOptions struct {
	SettleDelay time.Duration // How long to wait before emitting events to allow late-persisting events to appear
	BufferSize  int           // How many events to buffer
	MinBackoff  time.Duration // Minimum interval between polling requests
	MaxBackoff  time.Duration // Maximum interval between polling requests

	// CaptureReady, when set, is a buffered channel that gets one value: nil
	// once the notifier captures every later write, or the error that stopped it.
	CaptureReady chan<- error

	// Invalidate, when set, replaces the notifier's invalidator for this watch:
	// it is called when this watch may have missed writes. It must not block.
	Invalidate func()

	// OnLate, when set, gets each event that arrived after the settle buffer
	// had emitted a later RV of its collection, so it cannot be emitted in
	// order. Returning true drops it, otherwise it is emitted out of order. It
	// must not block.
	OnLate func(Event) (drop bool)

	// SettlePerCollection keeps RVs ascending per collection instead of across
	// all of them, so a busy collection does not hold back the others. Only for
	// backends whose RVs are not comparable across collections; KV watches
	// rely on the global order, for example for bookmarks.
	SettlePerCollection bool
}

func (opts WatchOptions) captured(err error) {
	if opts.CaptureReady != nil {
		opts.CaptureReady <- err
	}
}

func (opts WatchOptions) normalize() WatchOptions {
	if opts.SettleDelay <= 0 {
		opts.SettleDelay = defaultSettleDelay
	}
	if opts.BufferSize == 0 {
		opts.BufferSize = defaultBufferSize
	}
	if opts.MinBackoff <= 0 {
		opts.MinBackoff = defaultMinBackoff
	}
	if opts.MaxBackoff <= 0 || opts.MaxBackoff <= opts.MinBackoff {
		opts.MaxBackoff = defaultMaxBackoff
	}
	return opts
}

func newNotifier(eventStore *eventStore, opts notifierOptions) notifier {
	if opts.enableNatsNotifier {
		if opts.eventSubscriber != nil && opts.eventSubscriber.Enabled() {
			return newNatsNotifier(opts.eventSubscriber, opts.invalidator, opts.natsDropped, opts.log.With("notifier", "natsNotifier"))
		}
		opts.log.Warn("nats notifier requested but subscriber unavailable, falling back to polling")
	}

	if opts.useChannelNotifier {
		return newChannelNotifier(opts.log.With("notifier", "channelNotifier"))
	}

	return &pollingNotifier{eventStore: eventStore, log: opts.log.With("notifier", "pollingNotifier")}
}

type channelNotifier struct {
	log         logging.Logger
	subscribers map[chan Event]struct{}
	mu          sync.Mutex
}

func newChannelNotifier(log logging.Logger) *channelNotifier {
	return &channelNotifier{
		log:         log,
		subscribers: make(map[chan Event]struct{}),
	}
}

func (cn *channelNotifier) Watch(ctx context.Context, opts WatchOptions) <-chan Event {
	cn.log.Info("creating new notifier",
		"settle_delay", opts.SettleDelay,
		"buffer_size", opts.BufferSize,
		"min_backoff", opts.MinBackoff,
		"max_backoff", opts.MaxBackoff,
	)

	// Raw channel that Publish writes into; acts as a fixed-size buffer of
	// events that will eventually be "settled" and sent to the watcher.
	raw := make(chan Event, opts.BufferSize)
	cn.mu.Lock()
	cn.subscribers[raw] = struct{}{}
	cn.mu.Unlock()
	opts.captured(nil)

	// Output channel with settled, sorted events, returned to the watcher.
	out := make(chan Event, opts.BufferSize)

	context.AfterFunc(ctx, func() {
		cn.mu.Lock()
		delete(cn.subscribers, raw)
		close(raw)
		cn.mu.Unlock()
	})

	go settleEvents(ctx, raw, out, opts)

	return out
}

// settleEvents pumps raw to out with ascending RVs, across all collections or,
// with opts.SettlePerCollection, within each, so that watches stay monotonic,
// avoiding stale caches and 410 relist storms. Each event is held for
// opts.SettleDelay after it arrives, so an event with a lower RV that arrives up
// to that much later is still emitted first. Holding from arrival, not from the
// RV's timestamp, keeps the window independent of clock skew between writers,
// the database and this instance. Events that arrive after a later RV of their
// queue was emitted go to opts.OnLate and, unless it drops them, out at once.
// Closes out and returns when ctx is canceled or raw is closed.
func settleEvents(ctx context.Context, raw <-chan Event, out chan<- Event, opts WatchOptions) {
	defer close(out)
	queues := make(map[GroupResource]*settleQueue)
	pending := 0

	// The timer is armed for the earliest due head of any collection. Events
	// that arrive later are due later, so arrivals only arm a stopped timer.
	timer := time.NewTimer(opts.SettleDelay)
	timer.Stop()
	defer timer.Stop()
	armed := false

	for {
		var due <-chan time.Time
		if armed {
			due = timer.C
		}
		select {
		case evt, ok := <-raw:
			if !ok {
				return // channel closed, context canceled
			}
			var key GroupResource
			if opts.SettlePerCollection {
				key = GroupResource{Group: evt.Group, Resource: evt.Resource}
			}
			q := queues[key]
			if q == nil {
				q = &settleQueue{}
				queues[key] = q
			}
			if evt.ResourceVersion <= q.emitted {
				if opts.OnLate != nil && opts.OnLate(evt) {
					continue
				}
				// A later RV already went out, so holding it cannot restore the
				// order, and as the queue head it would delay the events
				// waiting behind it.
				select {
				case out <- evt:
				case <-ctx.Done():
					return
				}
				continue
			}
			q.insert(settlingEvent{Event: evt, due: time.Now().Add(opts.SettleDelay)})
			pending++
			if !armed {
				timer.Reset(opts.SettleDelay)
				armed = true
			}
			continue
		case <-due:
			armed = false
		case <-ctx.Done():
			return
		}

		now := time.Now()
		var next time.Time
		for _, q := range queues {
			// Within a queue the lowest RV holds back the rest until it settles.
			settled := 0
			for settled < len(q.events) && !q.events[settled].due.After(now) {
				select {
				case out <- q.events[settled].Event:
				case <-ctx.Done():
					return
				}
				q.emitted = max(q.emitted, q.events[settled].ResourceVersion)
				settled++
			}
			q.consume(settled)
			pending -= settled
			if len(q.events) > 0 && (next.IsZero() || q.events[0].due.Before(next)) {
				next = q.events[0].due
			}
		}
		if pending > 0 {
			timer.Reset(time.Until(next))
			armed = true
		}
	}
}

type settlingEvent struct {
	Event
	due time.Time
}

// settleQueue holds settling events in ascending RV order.
type settleQueue struct {
	events []settlingEvent
	// emitted is the highest RV emitted from the queue.
	emitted int64
}

func (q *settleQueue) insert(e settlingEvent) {
	// Events mostly arrive in order or close to it, so the insert usually lands
	// at or near the end.
	i, _ := slices.BinarySearchFunc(q.events, e.ResourceVersion, func(p settlingEvent, rv int64) int {
		return cmp.Compare(p.ResourceVersion, rv)
	})
	q.events = slices.Insert(q.events, i, e)
}

// consume drops the first n events without moving the rest, so flushing a
// prefix does not copy the remaining backlog.
func (q *settleQueue) consume(n int) {
	clear(q.events[:n])
	q.events = q.events[n:]
}

func (cn *channelNotifier) Publish(event Event) {
	cn.mu.Lock()
	defer cn.mu.Unlock()

	for ch := range cn.subscribers {
		select {
		case ch <- event:
		default:
			cn.log.Warn("dropped event notification, channel full")
		}
	}
}

// Return the last resource version from the event store
func (n *pollingNotifier) lastEventResourceVersion(ctx context.Context) (int64, error) {
	e, err := n.eventStore.LastEventKey(ctx)
	if err != nil {
		return 0, err
	}
	return e.ResourceVersion, nil
}

func (n *pollingNotifier) Watch(ctx context.Context, opts WatchOptions) <-chan Event {
	n.log.Info("creating new notifier",
		"settle_delay", opts.SettleDelay,
		"buffer_size", opts.BufferSize,
		"min_backoff", opts.MinBackoff,
		"max_backoff", opts.MaxBackoff,
	)

	events := make(chan Event, opts.BufferSize)

	lastEmittedRV, err := n.lastEventResourceVersion(ctx)
	if errors.Is(err, ErrNotFound) {
		lastEmittedRV = 0 // No events yet, start from the beginning
	} else if err != nil {
		n.log.Error("Failed to get last event resource version", "error", err)
		if opts.CaptureReady != nil {
			opts.captured(err)
			close(events)
			return events
		}
	}
	opts.captured(nil)

	go func() {
		defer close(events)

		eventKey := func(e Event) string {
			return fmt.Sprintf("%s~%s~%s~%s~%d", e.Namespace, e.Group, e.Resource, e.Name, e.ResourceVersion)
		}

		var buffer []Event
		// seen is the set of buffered event keys, used to deduplicate events across polling cycles.
		seen := make(map[string]bool)

		currentInterval := opts.MinBackoff
		backoffConfig := backoff.Config{
			MinBackoff: opts.MinBackoff,
			MaxBackoff: opts.MaxBackoff,
			MaxRetries: 0, // infinite retries
		}
		bo := backoff.New(ctx, backoffConfig)

		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(currentInterval):
				// Poll for new events since lastEmittedRV.
				// ListSince is inclusive, so skip events at or below lastEmittedRV.
				listFailed := false
				for evt, err := range n.eventStore.ListSince(ctx, lastEmittedRV) {
					if err != nil {
						n.log.Error("Failed to list events since", "error", err)
						listFailed = true
						break
					}
					if evt.ResourceVersion <= lastEmittedRV {
						continue
					}
					key := eventKey(evt)
					if seen[key] {
						continue
					}
					seen[key] = true
					buffer = append(buffer, evt)
				}

				// A partial scan may end within a shared RV. Retain the buffer, but
				// do not advance lastEmittedRV past unread events until a scan succeeds.
				if listFailed {
					currentInterval = bo.NextDelay()
					continue
				}

				// Sort buffer by RV
				slices.SortFunc(buffer, func(a, b Event) int {
					return cmp.Compare(a.ResourceVersion, b.ResourceVersion)
				})

				// Compute threshold: only emit events whose snowflake timestamp
				// is older than settleDelay ago
				threshold := snowflakeFromTime(time.Now().Add(-opts.SettleDelay))

				// Emit settled events
				emitted := 0
				for emitted < len(buffer) && buffer[emitted].ResourceVersion <= threshold {
					select {
					case events <- buffer[emitted]:
					case <-ctx.Done():
						return
					}
					lastEmittedRV = buffer[emitted].ResourceVersion
					delete(seen, eventKey(buffer[emitted]))
					emitted++
				}

				// Trim emitted events from buffer
				buffer = buffer[emitted:]

				// Backoff: reset if we emitted events or buffer is non-empty; increase otherwise
				if emitted > 0 || len(buffer) > 0 {
					bo.Reset()
					currentInterval = opts.MinBackoff
				} else {
					currentInterval = bo.NextDelay()
				}
			}
		}
	}()
	return events
}

func (n *pollingNotifier) Publish(_ Event) {
	// no-op
}
