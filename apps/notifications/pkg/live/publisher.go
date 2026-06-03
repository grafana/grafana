package live

import (
	"encoding/json"
	"fmt"

	authlibTypes "github.com/grafana/authlib/types"
	notificationsv0alpha1 "github.com/grafana/grafana/apps/notifications/pkg/apis/notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/live"
)

// EventKind identifies the kind of notification lifecycle event.
type EventKind string

const (
	EventCreated EventKind = "created"
	EventDeleted EventKind = "deleted"
)

// Event is the payload published on the Grafana Live notifications channel.
type Event struct {
	Kind         EventKind                           `json:"kind"`
	Notification *notificationsv0alpha1.Notification `json:"notification,omitempty"`
	UID          string                              `json:"uid,omitempty"`
}

// Publisher pushes notification lifecycle events to Grafana Live.
type Publisher struct {
	svc *live.GrafanaLive
}

// NewPublisher creates a Publisher backed by the given GrafanaLive service.
func NewPublisher(svc *live.GrafanaLive) *Publisher { return &Publisher{svc: svc} }

// publish encodes evt and sends it to the per-user channel for the given org.
func (p *Publisher) publish(orgID int64, recipientUID string, evt Event) error {
	payload, err := json.Marshal(evt)
	if err != nil {
		return err
	}
	ns := authlibTypes.OrgNamespaceFormatter(orgID)
	channel := fmt.Sprintf("grafana/notifications/%s", recipientUID)
	return p.svc.Publish(ns, channel, payload)
}

// PublishCreated broadcasts a created event for the given notification.
func (p *Publisher) PublishCreated(n *notificationsv0alpha1.Notification) error {
	return p.publish(n.Spec.OrgID, n.Spec.RecipientUID, Event{Kind: EventCreated, Notification: n})
}

// PublishDeleted broadcasts a deleted event for the given notification.
func (p *Publisher) PublishDeleted(n *notificationsv0alpha1.Notification) error {
	return p.publish(n.Spec.OrgID, n.Spec.RecipientUID, Event{Kind: EventDeleted, UID: n.Name})
}
