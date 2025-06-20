package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

const (
	eventsSection         = "unified/events"
	defaultLookbackPeriod = 10 * time.Second
	defaultPollInterval   = 100 * time.Millisecond
	defaultEventCacheSize = 10000
	defaultBufferSize     = 10000
)

type kvNotifier struct {
	kv   KV
	opts KVNotifierOptions

	// UID deduplication tracking
	mu        sync.RWMutex
	seenRVs   map[int64]bool
	rvHistory []int64
	rvIndex   int
	initialRV int64
}

type EventKey struct {
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
}
type Event struct {
	Namespace       string         `json:"namespace"`
	Group           string         `json:"group"`
	Resource        string         `json:"resource"`
	Name            string         `json:"name"`
	ResourceVersion int64          `json:"resource_version"`
	Action          MetaDataAction `json:"action"`
	Folder          string         `json:"folder"`
	PreviousRV      int64          `json:"previous_rv"`
}

type KVNotifierOptions struct {
	LookbackPeriod time.Duration // How far back to look for events
	PollInterval   time.Duration // How often to poll for new events
	BufferSize     int           // How many events to buffer
	EventCacheSize int           // How many events to cache
	InitialRV      int64         // The initial resource version to start from
}

func newKVNotifier(kv KV, opts KVNotifierOptions) *kvNotifier {
	if opts.PollInterval == 0 {
		opts.PollInterval = defaultPollInterval
	}
	if opts.EventCacheSize == 0 {
		opts.EventCacheSize = defaultEventCacheSize
	}
	if opts.BufferSize == 0 {
		opts.BufferSize = defaultBufferSize
	}
	if opts.InitialRV == 0 {
		opts.InitialRV = time.Now().UnixNano()
	}
	return &kvNotifier{
		kv:        kv,
		opts:      opts,
		seenRVs:   make(map[int64]bool),
		rvHistory: make([]int64, defaultEventCacheSize),
		rvIndex:   0,
		initialRV: opts.InitialRV,
	}
}

func (e *Event) getValue() ([]byte, error) {
	b, err := json.Marshal(e)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func parseEvent(value []byte) (Event, error) {
	var ev Event
	err := json.Unmarshal(value, &ev)
	if err != nil {
		return Event{}, err
	}
	return ev, nil
}

func (n *kvNotifier) getKey(key EventKey) string {
	return fmt.Sprintf("%d~%s~%s~%s~%s", key.ResourceVersion, key.Namespace, key.Group, key.Resource, key.Name)
}
func (n *kvNotifier) getStartKey(rv int64) string {
	return fmt.Sprintf("%d", rv)
}

// markUIDSeen adds a UID to the tracking system, removing the oldest if we exceed maxseenRVs
func (n *kvNotifier) markUIDSeen(rv int64) {
	n.mu.Lock()
	defer n.mu.Unlock()

	// If we already have this UID, no need to add it again
	if n.seenRVs[rv] {
		return
	}

	// If we're at capacity, remove the oldest UID
	if len(n.seenRVs) >= n.opts.EventCacheSize {
		oldUID := n.rvHistory[n.rvIndex]
		delete(n.seenRVs, oldUID)
	}

	// Add the new UID
	n.seenRVs[rv] = true
	n.rvHistory[n.rvIndex] = rv
	n.rvIndex = (n.rvIndex + 1) % n.opts.EventCacheSize
}

// hasSeenUID checks if we've already seen this UID
func (n *kvNotifier) hasSeenUID(rv int64) bool {
	// TODO: can we have conflict between multiple rvs ? RVs are not guaranteed to be unique
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.seenRVs[rv]
}

func (n *kvNotifier) Send(ctx context.Context, event Event) error {
	v, err := event.getValue()
	if err != nil {
		return err
	}
	err = n.kv.Save(ctx, eventsSection, n.getKey(EventKey{
		Namespace:       event.Namespace,
		Group:           event.Group,
		Resource:        event.Resource,
		Name:            event.Name,
		ResourceVersion: event.ResourceVersion,
	}), v)
	if err != nil {
		return err
	}
	return nil
}

func (n *kvNotifier) Notify(ctx context.Context) (<-chan Event, error) {
	events := make(chan Event)
	lastRV := n.initialRV
	go func() {
		defer close(events)
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(n.opts.PollInterval):
				startKey := n.getStartKey(lastRV) // TODO : implement lookback to ensure we don't miss any events
				fmt.Println("startKey", startKey)
				for k, err := range n.kv.Keys(ctx, eventsSection, ListOptions{StartKey: startKey}) {
					fmt.Println("k", k, "startKey", startKey, "k greater than lastRV")
					if err != nil {
						// TODO: Handle error
						continue
					}
					v, err := n.kv.Get(ctx, eventsSection, k)
					if err != nil {
						// TODO: Handle error
						continue
					}
					ev, err := parseEvent(v.Value)
					if err != nil {
						// TODO: Handle error
						continue
					}

					// Check if we've already seen this UID
					// if n.hasSeenUID(ev.ResourceVersion) {
					// 	continue // Skip this event as we've already processed it
					// }

					// Mark this UID as seen before sending the event
					// n.markUIDSeen(ev.ResourceVersion)

					if ev.ResourceVersion > lastRV {
						lastRV = ev.ResourceVersion
					}
					// Send the event
					fmt.Println("sending event", ev.ResourceVersion, "lastRV", lastRV, "name")
					select {
					case events <- ev:
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()
	return events, nil
}
