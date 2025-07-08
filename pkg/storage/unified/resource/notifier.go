package resource

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	gocache "github.com/patrickmn/go-cache"

	"time"
)

const (
	defaultLookbackPeriod = 30 * time.Second
	defaultPollInterval   = 100 * time.Millisecond
	defaultEventCacheSize = 10000
	defaultBufferSize     = 10000
)

type notifier struct {
	eventStore *eventStore
	log        logging.Logger
}

type notifierOptions struct {
	log logging.Logger
}

type watchOptions struct {
	LookbackPeriod time.Duration // How far back to look for events
	PollInterval   time.Duration // How often to poll for new events
	BufferSize     int           // How many events to buffer
}

func defaultWatchOptions() watchOptions {
	return watchOptions{
		LookbackPeriod: defaultLookbackPeriod,
		PollInterval:   defaultPollInterval,
		BufferSize:     defaultBufferSize,
	}
}

func newNotifier(eventStore *eventStore, opts notifierOptions) *notifier {
	if opts.log == nil {
		opts.log = &logging.NoOpLogger{}
	}
	return &notifier{eventStore: eventStore, log: opts.log}
}

// Return the last resource version from the event store
func (n *notifier) lastEventResourceVersion(ctx context.Context) (int64, error) {
	e, err := n.eventStore.LastEventKey(ctx)
	if err != nil {
		return 0, err
	}
	return e.ResourceVersion, nil
}

func (n *notifier) cacheKey(evt Event) string {
	return fmt.Sprintf("%s~%s~%s~%s~%d", evt.Namespace, evt.Group, evt.Resource, evt.Name, evt.ResourceVersion)
}

func (n *notifier) Watch(ctx context.Context, opts watchOptions) <-chan Event {
	if opts.PollInterval <= 0 {
		opts.PollInterval = defaultPollInterval
	}
	cacheTTL := opts.LookbackPeriod
	cacheCleanupInterval := 2 * opts.LookbackPeriod

	cache := gocache.New(cacheTTL, cacheCleanupInterval)
	events := make(chan Event, opts.BufferSize)

	initialRV, err := n.lastEventResourceVersion(ctx)
	if errors.Is(err, ErrNotFound) {
		initialRV = 0 // No events yet, start from the beginning
	} else if err != nil {
		n.log.Error("Failed to get last event resource version", "error", err)
	}
	lastRV := initialRV + 1 // We want to start watching from the next event

	go func() {
		defer close(events)
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(opts.PollInterval):
				for evt, err := range n.eventStore.ListSince(ctx, lastRV-opts.LookbackPeriod.Nanoseconds()) {
					if err != nil {
						n.log.Error("Failed to list events since", "error", err)
						continue
					}

					// Skip old events lower than the requested resource version
					if evt.ResourceVersion <= initialRV {
						continue
					}

					// Skip if the event is already sent
					if _, found := cache.Get(n.cacheKey(evt)); found {
						continue
					}

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
			}
		}
	}()
	return events
}
