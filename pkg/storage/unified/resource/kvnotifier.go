package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
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

	return &kvNotifier{
		kv:        kv,
		opts:      opts,
		seenRVs:   make(map[int64]bool),
		rvHistory: make([]int64, defaultEventCacheSize),
		rvIndex:   0,
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

// parseKey parses a key string back into an EventKey struct
// Key format is: "rv~namespace~group~resource~name"
func (n *kvNotifier) parseKey(key string) (EventKey, error) {
	parts := strings.Split(key, "~")
	if len(parts) != 5 {
		return EventKey{}, fmt.Errorf("invalid key format: expected 5 parts, got %d", len(parts))
	}

	rv, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return EventKey{}, fmt.Errorf("invalid resource version: %w", err)
	}

	return EventKey{
		ResourceVersion: rv,
		Namespace:       parts[1],
		Group:           parts[2],
		Resource:        parts[3],
		Name:            parts[4],
	}, nil
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

// getLastResourceVersion efficiently fetches the highest resource version from the events store
func (n *kvNotifier) getLastResourceVersion(ctx context.Context) int64 {
	lastRV := int64(0)

	// Use ListOptions with SortOrderDesc and Limit=1 to get only the highest resource version
	opts := ListOptions{
		Sort:  SortOrderDesc,
		Limit: 1,
	}

	for obj, err := range n.kv.List(ctx, eventsSection, opts) {
		if err != nil {
			continue
		}
		// Parse the key to extract the resource version
		if eventKey, err := n.parseKey(obj.Key); err == nil && eventKey.ResourceVersion > lastRV {
			lastRV = eventKey.ResourceVersion
		}
		// Since we're using Limit=1, we only need to process the first (highest) key
		break
	}

	return lastRV
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

	// Find the current highest resource version to start watching from
	lastRV := n.getLastResourceVersion(ctx) + 1

	go func() {
		defer close(events)
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(n.opts.PollInterval):
				startKey := n.getStartKey(lastRV) // TODO : implement lookback to ensure we don't miss any events
				for obj, err := range n.kv.List(ctx, eventsSection, ListOptions{StartKey: startKey}) {
					if err != nil {
						// TODO: Handle error
						continue
					}
					ev, err := parseEvent(obj.Value)
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
						lastRV = ev.ResourceVersion + 1
					}
					// Send the event
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
