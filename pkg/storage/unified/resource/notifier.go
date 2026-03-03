package resource

import (
	"cmp"
	"context"
	"errors"
	"slices"
	"sync"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/grafana/pkg/infra/log"

	"time"
)

const (
	defaultLookbackPeriod = 30 * time.Second
	defaultSettleDelay    = 500 * time.Millisecond
	defaultMinBackoff     = 100 * time.Millisecond
	defaultMaxBackoff     = 5 * time.Second
	defaultBufferSize     = 10000
)

type notifier interface {
	// Watch returns a channel that will receive events as they happen.
	Watch(context.Context, watchOptions) <-chan Event
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
}

type watchOptions struct {
	SettleDelay time.Duration // How long to wait before emitting events to allow late-persisting events to appear
	BufferSize  int           // How many events to buffer
	MinBackoff  time.Duration // Minimum interval between polling requests
	MaxBackoff  time.Duration // Maximum interval between polling requests
}

func defaultWatchOptions() watchOptions {
	return watchOptions{
		SettleDelay: defaultSettleDelay,
		BufferSize:  defaultBufferSize,
		MinBackoff:  defaultMinBackoff,
		MaxBackoff:  defaultMaxBackoff,
	}
}

func newNotifier(eventStore *eventStore, opts notifierOptions) notifier {
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

func (cn *channelNotifier) Watch(ctx context.Context, opts watchOptions) <-chan Event {
	cn.log.Info("creating new notifier", "buffer_size", opts.BufferSize)
	events := make(chan Event, opts.BufferSize)

	cn.mu.Lock()
	cn.subscribers[events] = struct{}{}
	cn.mu.Unlock()

	context.AfterFunc(ctx, func() {
		cn.mu.Lock()
		delete(cn.subscribers, events)
		close(events)
		cn.mu.Unlock()
	})

	return events
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

func (n *pollingNotifier) Watch(ctx context.Context, opts watchOptions) <-chan Event {
	if opts.MinBackoff <= 0 {
		opts.MinBackoff = defaultMinBackoff
	}
	if opts.MaxBackoff <= 0 || opts.MaxBackoff <= opts.MinBackoff {
		opts.MaxBackoff = defaultMaxBackoff
	}
	if opts.SettleDelay <= 0 {
		opts.SettleDelay = defaultSettleDelay
	}

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

		var buffer []Event
		seen := make(map[int64]bool)

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
					if seen[evt.ResourceVersion] {
						continue
					}
					seen[evt.ResourceVersion] = true
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
					delete(seen, buffer[emitted].ResourceVersion)
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
