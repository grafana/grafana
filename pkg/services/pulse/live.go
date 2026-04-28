package pulse

import (
	"encoding/json"
	"time"
)

// EventAction is the kind of pulse activity broadcast on a Live channel.
type EventAction string

const (
	EventThreadCreated EventAction = "thread_created"
	EventPulseAdded    EventAction = "pulse_added"
	EventPulseEdited   EventAction = "pulse_edited"
	EventPulseDeleted  EventAction = "pulse_deleted"
)

// Event is the payload broadcast on grafana/pulse/<resourceKind>/<resourceUID>.
//
// Frontend clients use these events to invalidate RTK Query caches and to
// drive the unread badge. We deliberately do not include the full body here:
// clients refetch via HTTP after seeing an event, which keeps this channel
// small and avoids leaking content to subscribers who happen to have stale
// permissions.
type Event struct {
	Action       EventAction `json:"action"`
	OrgID        int64       `json:"orgId"`
	ResourceKind string      `json:"resourceKind"`
	ResourceUID  string      `json:"resourceUID"`
	ThreadUID    string      `json:"threadUID"`
	PulseUID     string      `json:"pulseUID,omitempty"`
	AuthorUserID int64       `json:"authorUserId,omitempty"`
	At           time.Time   `json:"at"`
}

// MarshalJSON keeps timestamps RFC3339 with millisecond precision so the
// frontend can compare them as strings without parse drift.
func (e Event) MarshalJSON() ([]byte, error) {
	type alias Event
	return json.Marshal(struct {
		alias
		At string `json:"at"`
	}{
		alias: alias(e),
		At:    e.At.UTC().Format(time.RFC3339Nano),
	})
}

// Publisher broadcasts pulse events to subscribed clients. The pulse
// service depends on this small interface rather than on the full Grafana
// Live service, which keeps tests simple. Live is a best-effort signal —
// if Publish returns an error we log and continue; the polling fallback
// will catch up clients on the next tick.
type Publisher interface {
	Publish(orgID int64, event Event) error
}

// noopPublisher is the safe default for unit tests and for environments
// where Live is disabled.
type noopPublisher struct{}

func (noopPublisher) Publish(int64, Event) error { return nil }

// NoopPublisher is exposed so wire and tests can substitute it explicitly.
func NoopPublisher() Publisher { return noopPublisher{} }
