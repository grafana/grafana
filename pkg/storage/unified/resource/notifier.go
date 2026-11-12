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

// settleEvents pumps raw to out in ascending RV order, keeping downstream RVs
// monotonic and so avoiding stale caches and 410 relist storms. Each event is
// held for opts.SettleDelay after it arrives, so an event with a lower RV that
// arrives up to that much later is still emitted first. Holding from arrival,
// not from the RV's timestamp, keeps the window independent of clock skew
// between writers, the database and this instance. Events that arrive after a
// later RV of their collection was emitted go to opts.OnLate.
// Closes out and returns when ctx is canceled or raw is closed.
func settleEvents(ctx context.Context, raw <-chan Event, out chan<- Event, opts WatchOptions) {
	defer close(out)
	var pending []settlingEvent // ascending RV
	emitted := make(map[GroupResource]int64)

	timer := time.NewTimer(opts.SettleDelay)
	timer.Stop()
	defer timer.Stop()

	for {
		var due <-chan time.Time
		if len(pending) > 0 {
			due = timer.C
		}
		select {
		case evt, ok := <-raw:
			if !ok {
				return // channel closed, context canceled
			}
			late := evt.ResourceVersion <= emitted[GroupResource{Group: evt.Group, Resource: evt.Resource}]
			if late && opts.OnLate != nil && opts.OnLate(evt) {
				continue
			}
			i, _ := slices.BinarySearchFunc(pending, evt.ResourceVersion, func(p settlingEvent, rv int64) int {
				return cmp.Compare(p.ResourceVersion, rv)
			})
			pending = slices.Insert(pending, i, settlingEvent{Event: evt, due: time.Now().Add(opts.SettleDelay)})
			if i == 0 {
				timer.Reset(time.Until(pending[0].due))
			}
			continue
		case <-due:
		case <-ctx.Done():
			return
		}

		// The lowest RV holds back the rest until it settles.
		now := time.Now()
		settled := 0
		for settled < len(pending) && !pending[settled].due.After(now) {
			evt := pending[settled].Event
			select {
			case out <- evt:
			case <-ctx.Done():
				return
			}
			gr := GroupResource{Group: evt.Group, Resource: evt.Resource}
			emitted[gr] = max(emitted[gr], evt.ResourceVersion)
			settled++
		}
		pending = slices.Delete(pending, 0, settled)
		if len(pending) > 0 {
			timer.Reset(time.Until(pending[0].due))
		}
	}
}

type settlingEvent struct {
	Event
	due time.Time
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
