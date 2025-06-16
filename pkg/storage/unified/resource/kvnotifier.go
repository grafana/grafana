package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

const (
	prefixEvents          = "/unified/events"
	defaultLookbackPeriod = 1 * time.Minute
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

type Event struct {
	Namespace       string         `json:"namespace"`
	Group           string         `json:"group"`
	Resource        string         `json:"resource"`
	Name            string         `json:"name"`
	Action          MetaDataAction `json:"action"`
	Folder          string         `json:"folder"`
	ResourceVersion int64          `json:"resource_version"`
	PreviousRV      int64          `json:"previous_rv"`
}

type KVNotifierOptions struct {
	LookbackPeriod time.Duration // How far back to look for events
	PollInterval   time.Duration // How often to poll for new events
	BufferSize     int           // How many events to buffer
	EventCacheSize int           // How many events to cache
}

func newKVNotifier(kv KV, opts KVNotifierOptions) *kvNotifier {
	if opts.LookbackPeriod == 0 {
		opts.LookbackPeriod = defaultLookbackPeriod
	}
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

func (n *kvNotifier) getKey(rv int64) string {
	return fmt.Sprintf("%s/%d", prefixEvents, rv)
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
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.seenRVs[rv]
}

func (n *kvNotifier) Send(ctx context.Context, event Event) error {
	v, err := event.getValue()
	if err != nil {
		return err
	}
	err = n.kv.Save(ctx, n.getKey(event.ResourceVersion), v)
	if err != nil {
		return err
	}
	return nil
}

func (n *kvNotifier) Notify(ctx context.Context) (<-chan Event, error) {
	events := make(chan Event, n.opts.BufferSize)
	lastRV := time.Now().Add(-n.opts.LookbackPeriod).UnixMilli()
	go func() {
		defer close(events)
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(n.opts.PollInterval):
				startKey := n.getKey(lastRV) // TODO : implement lookback to ensure we don't miss any events
				for k, err := range n.kv.List(ctx, ListOptions{StartKey: startKey, EndKey: PrefixRangeEnd(prefixEvents)}) {
					if err != nil {
						// TODO: Handle error
						continue
					}
					v, err := n.kv.Get(ctx, k)
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
					if n.hasSeenUID(ev.ResourceVersion) {
						continue // Skip this event as we've already processed it
					}

					// Mark this UID as seen before sending the event
					n.markUIDSeen(ev.ResourceVersion)

					if ev.ResourceVersion > lastRV {
						lastRV = ev.ResourceVersion
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
