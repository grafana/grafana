package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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

func (k EventKey) String() string {
	return fmt.Sprintf("%d~%s~%s~%s~%s", k.ResourceVersion, k.Namespace, k.Group, k.Resource, k.Name)
}

func (k EventKey) Validate() error {
	if k.Namespace == "" {
		return fmt.Errorf("namespace cannot be empty")
	}
	if k.Group == "" {
		return fmt.Errorf("group cannot be empty")
	}
	if k.Resource == "" {
		return fmt.Errorf("resource cannot be empty")
	}
	if k.Name == "" {
		return fmt.Errorf("name cannot be empty")
	}
	if k.ResourceVersion < 0 {
		return fmt.Errorf("resource version must be non-negative")
	}

	// Validate each field against the naming rules (reusing the regex from datastore.go)
	if !validNameRegex.MatchString(k.Namespace) {
		return fmt.Errorf("namespace '%s' is invalid", k.Namespace)
	}
	if !validNameRegex.MatchString(k.Group) {
		return fmt.Errorf("group '%s' is invalid", k.Group)
	}
	if !validNameRegex.MatchString(k.Resource) {
		return fmt.Errorf("resource '%s' is invalid", k.Resource)
	}
	if !validNameRegex.MatchString(k.Name) {
		return fmt.Errorf("name '%s' is invalid", k.Name)
	}

	return nil
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

// ParseEventKey parses a key string back into an EventKey struct
func ParseEventKey(key string) (EventKey, error) {
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
		eventKey, err := ParseEventKey(key)
		if err != nil {
			return EventKey{}, err
		}
		return eventKey, nil
	}

	return EventKey{}, ErrNotFound
}

// Save an event to the store.
func (n *eventStore) Save(ctx context.Context, event Event) error {
	eventKey := EventKey{
		Namespace:       event.Namespace,
		Group:           event.Group,
		Resource:        event.Resource,
		Name:            event.Name,
		ResourceVersion: event.ResourceVersion,
	}

	if err := eventKey.Validate(); err != nil {
		return fmt.Errorf("invalid event key: %w", err)
	}

	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	if err := encoder.Encode(event); err != nil {
		return err
	}
	return n.kv.Save(ctx, eventsSection, eventKey.String(), &buf)
}

func (n *eventStore) Get(ctx context.Context, key EventKey) (Event, error) {
	if err := key.Validate(); err != nil {
		return Event{}, fmt.Errorf("invalid event key: %w", err)
	}

	obj, err := n.kv.Get(ctx, eventsSection, key.String())
	if err != nil {
		return Event{}, err
	}
	defer obj.Value.Close()

	var event Event
	err = json.NewDecoder(obj.Value).Decode(&event)
	return event, err
}

// ListSince returns a sequence of events since the given resource version.
func (n *eventStore) ListSince(ctx context.Context, sinceRV int64) iter.Seq2[Event, error] {
	opts := ListOptions{
		Sort: SortOrderAsc,
		StartKey: EventKey{
			ResourceVersion: sinceRV,
		}.String(),
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
