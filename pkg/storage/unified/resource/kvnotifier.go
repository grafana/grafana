package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	prefixEvents          = "/unified/events"
	defaultLookbackPeriod = 1 * time.Minute
	defaultPollInterval   = 100 * time.Millisecond
	defaultEventCacheSize = 10000
)

type kvNotifier struct {
	kv   KV
	opts KVNotifierOptions

	// UID deduplication tracking
	mu         sync.RWMutex
	seenUIDs   map[uuid.UUID]bool
	uidHistory []uuid.UUID
	uidIndex   int
}

type Event struct {
	Namespace string         `json:"namespace"`
	Group     string         `json:"group"`
	Resource  string         `json:"resource"`
	Name      string         `json:"name"`
	UID       uuid.UUID      `json:"uid"`
	Action    MetaDataAction `json:"action"`
	Folder    string         `json:"folder"`
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
	return &kvNotifier{
		kv:         kv,
		opts:       opts,
		seenUIDs:   make(map[uuid.UUID]bool),
		uidHistory: make([]uuid.UUID, defaultEventCacheSize),
		uidIndex:   0,
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

func (n *kvNotifier) getKey(uid uuid.UUID) string {
	return fmt.Sprintf("%s/%s", prefixEvents, uid)
}

// markUIDSeen adds a UID to the tracking system, removing the oldest if we exceed maxSeenUIDs
func (n *kvNotifier) markUIDSeen(uid uuid.UUID) {
	n.mu.Lock()
	defer n.mu.Unlock()

	// If we already have this UID, no need to add it again
	if n.seenUIDs[uid] {
		return
	}

	// If we're at capacity, remove the oldest UID
	if len(n.seenUIDs) >= n.opts.EventCacheSize {
		oldUID := n.uidHistory[n.uidIndex]
		delete(n.seenUIDs, oldUID)
	}

	// Add the new UID
	n.seenUIDs[uid] = true
	n.uidHistory[n.uidIndex] = uid
	n.uidIndex = (n.uidIndex + 1) % n.opts.EventCacheSize
}

// hasSeenUID checks if we've already seen this UID
func (n *kvNotifier) hasSeenUID(uid uuid.UUID) bool {
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.seenUIDs[uid]
}

func (n *kvNotifier) Send(ctx context.Context, event Event) error {
	v, err := event.getValue()
	if err != nil {
		return err
	}
	err = n.kv.Save(ctx, n.getKey(event.UID), v, SaveOptions{})
	if err != nil {
		return err
	}
	return nil
}

func (n *kvNotifier) Notify(ctx context.Context) (<-chan *Event, error) {
	events := make(chan *Event, n.opts.BufferSize)
	lastUID, _ := uuid.NewV7()
	go func() {
		defer close(events)
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(n.opts.PollInterval):
				startKey := n.getKey(lastUID) // TODO : lookback here is critical
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
					if n.hasSeenUID(ev.UID) {
						continue // Skip this event as we've already processed it
					}

					// Mark this UID as seen before sending the event
					n.markUIDSeen(ev.UID)

					rv, _ := rvFromUID(ev.UID)
					lastRV, _ := rvFromUID(lastUID)
					if rv > lastRV {
						lastUID = ev.UID
					}
					// Send the event
					select {
					case events <- &ev:
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()
	return events, nil
}
