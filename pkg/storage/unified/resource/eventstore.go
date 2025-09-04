package resource

import (
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
	Action          DataAction
}

func (k EventKey) String() string {
	return fmt.Sprintf("%d~%s~%s~%s~%s~%s", k.ResourceVersion, k.Namespace, k.Group, k.Resource, k.Name, k.Action)
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
	if k.Action == "" {
		return fmt.Errorf("action cannot be empty")
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

	switch k.Action {
	case DataActionCreated, DataActionUpdated, DataActionDeleted:
	default:
		return fmt.Errorf("action '%s' is invalid: must be one of 'created', 'updated', or 'deleted'", k.Action)
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
	if len(parts) != 6 {
		return EventKey{}, fmt.Errorf("invalid key format: expected 6 parts, got %d", len(parts))
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
		Action:          DataAction(parts[5]),
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
		Action:          event.Action,
	}

	if err := eventKey.Validate(); err != nil {
		return fmt.Errorf("invalid event key: %w", err)
	}

	writer, err := n.kv.Save(ctx, eventsSection, eventKey.String())
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(writer)
	if err := encoder.Encode(event); err != nil {
		_ = writer.Close()
		return err
	}

	return writer.Close()
}

func (n *eventStore) Get(ctx context.Context, key EventKey) (Event, error) {
	if err := key.Validate(); err != nil {
		return Event{}, fmt.Errorf("invalid event key: %w", err)
	}

	reader, err := n.kv.Get(ctx, eventsSection, key.String())
	if err != nil {
		return Event{}, err
	}
	defer func() { _ = reader.Close() }()
	var event Event
	if err = json.NewDecoder(reader).Decode(&event); err != nil {
		return Event{}, err
	}
	return event, nil
}

// ListSince returns a sequence of events since the given resource version.
func (n *eventStore) ListKeysSince(ctx context.Context, sinceRV int64) iter.Seq2[string, error] {
	opts := ListOptions{
		Sort: SortOrderAsc,
		StartKey: EventKey{
			ResourceVersion: sinceRV,
		}.String(),
	}
	return func(yield func(string, error) bool) {
		for evtKey, err := range n.kv.Keys(ctx, eventsSection, opts) {
			if err != nil {
				yield("", err)
				return
			}
			if !yield(evtKey, nil) {
				return
			}
		}
	}
}

func (n *eventStore) ListSince(ctx context.Context, sinceRV int64) iter.Seq2[Event, error] {
	return func(yield func(Event, error) bool) {
		for evtKey, err := range n.ListKeysSince(ctx, sinceRV) {
			if err != nil {
				yield(Event{}, err)
				return
			}

			reader, err := n.kv.Get(ctx, eventsSection, evtKey)
			if err != nil {
				yield(Event{}, err)
				return
			}

			var event Event
			if err := json.NewDecoder(reader).Decode(&event); err != nil {
				_ = reader.Close()
				yield(Event{}, err)
				return
			}

			_ = reader.Close()
			if !yield(event, nil) {
				return
			}
		}
	}
}
