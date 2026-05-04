package pulse

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/live"
)

// EventAction is the kind of pulse activity broadcast on a Live channel.
type EventAction string

const (
	EventThreadCreated  EventAction = "thread_created"
	EventThreadDeleted  EventAction = "thread_deleted"
	EventThreadClosed   EventAction = "thread_closed"
	EventThreadReopened EventAction = "thread_reopened"
	EventPulseAdded     EventAction = "pulse_added"
	EventPulseEdited    EventAction = "pulse_edited"
	EventPulseDeleted   EventAction = "pulse_deleted"
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

// ChannelPublisher is the small surface a transport (Grafana Live) must
// implement to receive pulse events. We accept (orgID, channel, []byte)
// so the wire bridge can prefix the K8s namespace on its side.
type ChannelPublisher interface {
	Publish(orgID int64, channel string, data []byte) error
}

// NewLivePublisher wraps a transport-level publisher (e.g. Grafana Live)
// in our event-shaped Publisher. The channel layout is
// `grafana/pulse/<resourceKind>/<resourceUID>` so subscribers only see
// events for the specific resource they opened.
func NewLivePublisher(p ChannelPublisher) Publisher {
	return &livePublisher{transport: p}
}

type livePublisher struct {
	transport ChannelPublisher
}

// ProvideChannelPublisher is the wire provider that adapts the Grafana
// Live service into a pulse-shaped ChannelPublisher. It exists in the
// pulse package so the live package never has to import pulse.
func ProvideChannelPublisher(g *live.GrafanaLive) ChannelPublisher {
	if g == nil {
		return noopChannelPublisher{}
	}
	return &liveChannelAdapter{live: g}
}

type liveChannelAdapter struct {
	live *live.GrafanaLive
}

func (a *liveChannelAdapter) Publish(orgID int64, channel string, data []byte) error {
	return a.live.PulseChannelPublish(orgID, channel, data)
}

type noopChannelPublisher struct{}

func (noopChannelPublisher) Publish(int64, string, []byte) error { return nil }

func (l *livePublisher) Publish(orgID int64, e Event) error {
	if l.transport == nil {
		return nil
	}
	data, err := json.Marshal(e)
	if err != nil {
		return err
	}
	channel := fmt.Sprintf("grafana/pulse/%s/%s", e.ResourceKind, e.ResourceUID)
	return l.transport.Publish(orgID, channel, data)
}
