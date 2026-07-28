package resource

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"

	"github.com/grafana/dskit/backoff"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"

	"time"
)

const (
	defaultSettleDelay = 3 * time.Second
	defaultMinBackoff  = 100 * time.Millisecond
	defaultMaxBackoff  = 5 * time.Second
	defaultBufferSize  = 10000
)

type notifier interface {
	// Watch returns a channel that will receive events as they happen.
	Watch(context.Context, WatchOptions) <-chan Event
	// Publish lets callers to inform watchers about events. Some notifiers
	// (e.g., channel notifier) require callers to provide the events to be published.
	// Others (e.g., polling notifier) queries events separately, making
	// publishing a no-op.
	Publish(Event)
}

type pollingNotifier struct {
	eventStore *eventStore
	log        log.Logger
}

type notifierOptions struct {
	log                log.Logger
	useChannelNotifier bool

	enableNatsNotifier bool
	eventSubscriber    EventSubscriber
	natsDropped        *prometheus.CounterVec
}

type WatchOptions struct {
	SettleDelay time.Duration // How long to wait before emitting events to allow late-persisting events to appear
	BufferSize  int           // How many events to buffer
	MinBackoff  time.Duration // Minimum interval between polling requests
	MaxBackoff  time.Duration // Maximum interval between polling requests
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
			return newNatsNotifier(opts.eventSubscriber, opts.natsDropped, opts.log.New("notifier", "natsNotifier"))
		}
		opts.log.Warn("nats notifier requested but subscriber unavailable, falling back to polling")
	}

	if opts.useChannelNotifier {
		return newChannelNotifier(opts.log.New("notifier", "channelNotifier"))
	}

	return &pollingNotifier{eventStore: eventStore, log: opts.log.New("notifier", "pollingNotifier")}
}

type channelNotifier struct {
	log         log.Logger
	subscribers map[chan Event]struct{}
	mu          sync.Mutex
}

func newChannelNotifier(log log.Logger) *channelNotifier {
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

// settleBuffer holds arrivals until they are old enough to emit. The drain
// goroutine fills it and the emit loop empties it, so a blocked emit does not
// stop the drain.
type settleBuffer struct {
	mu     sync.Mutex
	events []Event
	max    int
}

// add buffers evt, reporting false when the buffer is at capacity.
func (b *settleBuffer) add(evt Event) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.events) >= b.max {
		return false
	}
	b.events = append(b.events, evt)
	return true
}

// takeSettled removes and returns every event with an RV at or below threshold,
// in ascending RV order.
func (b *settleBuffer) takeSettled(threshold int64) []Event {
	b.mu.Lock()
	defer b.mu.Unlock()

	slices.SortFunc(b.events, func(a, b Event) int {
		return cmp.Compare(a.ResourceVersion, b.ResourceVersion)
	})

	settled := 0
	for settled < len(b.events) && b.events[settled].ResourceVersion <= threshold {
		settled++
	}
	if settled == 0 {
		return nil
	}
	taken := b.events[:settled:settled]
	b.events = b.events[settled:]
	return taken
}

// settleEvents pumps raw to out, buffering events for opts.SettleDelay so late
// or out-of-order arrivals are reordered: on each tick the buffer is sorted and
// events settled past now-SettleDelay are emitted in ascending RV order. This
// keeps downstream RVs monotonic, avoiding stale caches and 410 relist storms.
// Closes out and returns when ctx is canceled or raw is closed.
//
// Draining raw runs in its own goroutine so a blocked send to out never stops
// reading raw. Emission is tick-driven and therefore bursty — a second's worth
// of settled events is handed over at once — so a consumer that is briefly
// behind would otherwise back up raw and make the producer, which sends without
// blocking, drop notifications. Under sustained overload the buffer fills and
// the drain stalls, so raw backs up and the producer drops as before, keeping
// memory bounded and drop accounting in one place.
func settleEvents(ctx context.Context, raw <-chan Event, out chan<- Event, opts WatchOptions) {
	defer close(out)

	buffer := &settleBuffer{max: opts.BufferSize}
	drained := make(chan struct{}) // closed when raw closes or ctx is canceled

	go func() {
		defer close(drained)
		bo := backoff.New(ctx, backoff.Config{
			MinBackoff: opts.MinBackoff,
			MaxBackoff: opts.MaxBackoff,
			MaxRetries: 0, // infinite retries; ctx cancel stops the loop
		})
		for {
			var evt Event
			select {
			case e, ok := <-raw:
				if !ok {
					return // channel closed, context canceled
				}
				evt = e
			case <-ctx.Done():
				return
			}
			for !buffer.add(evt) {
				if !bo.Ongoing() {
					return
				}
				bo.Wait()
			}
			bo.Reset()
		}
	}()

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
		case <-drained:
			return
		case <-ctx.Done():
			return
		}

		// Emit events that have "settled" (old enough that concurrent writes should have appeared).
		for _, evt := range buffer.takeSettled(snowflakeFromTime(time.Now().Add(-opts.SettleDelay))) {
			select {
			case out <- evt:
			case <-ctx.Done():
				return
			}
		}
	}
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
	}

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
				for evt, err := range n.eventStore.ListSince(ctx, lastEmittedRV, SortOrderAsc) {
					if err != nil {
						n.log.Error("Failed to list events since", "error", err)
						continue
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
