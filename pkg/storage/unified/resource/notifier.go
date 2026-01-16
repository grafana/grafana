package resource

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/grafana-app-sdk/logging"
	gocache "github.com/patrickmn/go-cache"

	"time"
)

const (
	defaultLookbackPeriod = 30 * time.Second
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
	log        logging.Logger
}

type notifierOptions struct {
	log                logging.Logger
	useChannelNotifier bool
}

type watchOptions struct {
	LookbackPeriod time.Duration // How far back to look for events
	BufferSize     int           // How many events to buffer
	MinBackoff     time.Duration // Minimum interval between polling requests
	MaxBackoff     time.Duration // Maximum interval between polling requests
}

func defaultWatchOptions() watchOptions {
	return watchOptions{
		LookbackPeriod: defaultLookbackPeriod,
		BufferSize:     defaultBufferSize,
		MinBackoff:     defaultMinBackoff,
		MaxBackoff:     defaultMaxBackoff,
	}
}

func newNotifier(eventStore *eventStore, opts notifierOptions) notifier {
	if opts.log == nil {
		opts.log = &logging.NoOpLogger{}
	}

	if opts.useChannelNotifier {
		return newChannelNotifier(opts.log)
	}

	return &pollingNotifier{eventStore: eventStore, log: opts.log}
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

func (cn *channelNotifier) Watch(ctx context.Context, opts watchOptions) <-chan Event {
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

func (n *pollingNotifier) cacheKey(evt Event) string {
	return fmt.Sprintf("%s~%s~%s~%s~%d", evt.Namespace, evt.Group, evt.Resource, evt.Name, evt.ResourceVersion)
}

func (n *pollingNotifier) Watch(ctx context.Context, opts watchOptions) <-chan Event {
	if opts.MinBackoff <= 0 {
		opts.MinBackoff = defaultMinBackoff
	}
	if opts.MaxBackoff <= 0 || opts.MaxBackoff <= opts.MinBackoff {
		opts.MaxBackoff = defaultMaxBackoff
	}

	cacheTTL := opts.LookbackPeriod
	cacheCleanupInterval := 2 * opts.LookbackPeriod

	cache := gocache.New(cacheTTL, cacheCleanupInterval)
	events := make(chan Event, opts.BufferSize)

	lastRV, err := n.lastEventResourceVersion(ctx)
	if errors.Is(err, ErrNotFound) {
		lastRV = 0 // No events yet, start from the beginning
	} else if err != nil {
		n.log.Error("Failed to get last event resource version", "error", err)
	}
	lastRV = lastRV + 1 // We want to start watching from the next event

	go func() {
		defer close(events)
		// Initialize backoff with minimum backoff interval
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
				foundEvents := false
				for evt, err := range n.eventStore.ListSince(ctx, subtractDurationFromSnowflake(lastRV, opts.LookbackPeriod), SortOrderAsc) {
					if err != nil {
						n.log.Error("Failed to list events since", "error", err)
						continue
					}

					// Skip old events lower than the requested resource version
					if evt.ResourceVersion < lastRV {
						continue
					}

					// Skip if the event is already sent
					if _, found := cache.Get(n.cacheKey(evt)); found {
						continue
					}

					foundEvents = true
					if evt.ResourceVersion > lastRV {
						lastRV = evt.ResourceVersion + 1
					}
					// Send the event
					select {
					case events <- evt:
						cache.Set(n.cacheKey(evt), true, opts.LookbackPeriod)
					case <-ctx.Done():
						return
					}
				}

				// Apply backoff logic: reset to min when events are found, increase when no events
				if foundEvents {
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
