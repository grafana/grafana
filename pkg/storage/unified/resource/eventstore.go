package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"iter"
	"strconv"
	"strings"
)

const (
	eventsSection = "unified/events"
)

// eventStore is a store for events.
type eventStore struct {
	kv KV
}

type EventKey struct {
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
}

type Event struct {
	Namespace       string     `json:"namespace"`
	Group           string     `json:"group"`
	Resource        string     `json:"resource"`
	Name            string     `json:"name"`
	ResourceVersion int64      `json:"resource_version"`
	Action          DataAction `json:"action"`
	Folder          string     `json:"folder"`
	PreviousRV      int64      `json:"previous_rv"`
}

func newEventStore(kv KV) *eventStore {
	return &eventStore{
		kv: kv,
	}
}

func (n *eventStore) getKey(key EventKey) string {
	return fmt.Sprintf("%d~%s~%s~%s~%s", key.ResourceVersion, key.Namespace, key.Group, key.Resource, key.Name)
}

// parseKey parses a key string back into an EventKey struct
func (n *eventStore) parseKey(key string) (EventKey, error) {
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

// LastEventKey returns the Event Key of the event with the highest resource version.
// If no events are found, it returns ErrNotFound.
func (n *eventStore) LastEventKey(ctx context.Context) (EventKey, error) {

	for key, err := range n.kv.Keys(ctx, eventsSection, ListOptions{Sort: SortOrderDesc, Limit: 1}) {
		if err != nil {
			return EventKey{}, err
		}
		eventKey, err := n.parseKey(key)
		if err != nil {
			return EventKey{}, err
		}
		return eventKey, nil
	}

	return EventKey{}, ErrNotFound
}

// Save an event to the store.
func (n *eventStore) Save(ctx context.Context, event Event) error {
	v, err := json.Marshal(event)
	if err != nil {
		return err
	}
	err = n.kv.Save(ctx, eventsSection, n.getKey(EventKey{
		Namespace:       event.Namespace,
		Group:           event.Group,
		Resource:        event.Resource,
		Name:            event.Name,
		ResourceVersion: event.ResourceVersion,
	}), io.NopCloser(bytes.NewReader(v)))
	if err != nil {
		return err
	}
	return nil
}

func (n *eventStore) Get(ctx context.Context, key EventKey) (Event, error) {
	obj, err := n.kv.Get(ctx, eventsSection, n.getKey(key))
	if err != nil {
		return Event{}, err
	}
	var event Event
	if err := json.NewDecoder(obj.Value).Decode(&event); err != nil {
		return Event{}, err
	}
	return event, nil
}

// ListSince returns a sequence of events since the given resource version.
func (n *eventStore) ListSince(ctx context.Context, sinceRV int64) iter.Seq2[Event, error] {
	opts := ListOptions{
		Sort: SortOrderAsc,
		StartKey: n.getKey(EventKey{
			ResourceVersion: sinceRV,
		}),
	}
	return func(yield func(Event, error) bool) {
		for key, err := range n.kv.Keys(ctx, eventsSection, opts) {
			if err != nil {
				return
			}
			obj, err := n.kv.Get(ctx, eventsSection, key)
			if err != nil {
				return
			}
			var event Event
			if err := json.NewDecoder(obj.Value).Decode(&event); err != nil {
				return
			}
			if !yield(event, nil) {
				return
			}
		}
	}
}
