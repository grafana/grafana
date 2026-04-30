package pulse

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Notifier is the small surface the pulse service uses for fanout.
// Implementations can dispatch to email, in-app notifications, webhooks,
// etc. We keep this minimal so the v1 implementation can be a noop or a
// stub without dragging the whole notifications stack in.
type Notifier interface {
	NotifyPulse(ctx context.Context, e PulseNotification) error
}

// PulseNotification is the data passed to Notifier.NotifyPulse.
type PulseNotification struct {
	OrgID        int64
	ResourceKind ResourceKind
	ResourceUID  string
	ThreadUID    string
	PulseUID     string
	AuthorUserID int64
	Recipients   []int64
	BodyText     string
	IsMention    map[int64]bool
	ThreadTitle  string
	Reason       NotificationReason
}

// NotificationReason explains why a particular user was notified.
type NotificationReason string

const (
	ReasonMention      NotificationReason = "mention"
	ReasonSubscription NotificationReason = "subscription"
)

// LogOnlyNotifier is the v1 default: it logs the fanout decision so demo
// users can see what would be sent. Real email/webhook delivery layers on
// in a follow-up commit. The logger key set is structured so we can grep
// it cleanly in dev (`pulse.notification.fanout`).
type LogOnlyNotifier struct {
	Log log.Logger
}

func (n *LogOnlyNotifier) NotifyPulse(ctx context.Context, e PulseNotification) error {
	for _, uid := range e.Recipients {
		reason := string(ReasonSubscription)
		if e.IsMention[uid] {
			reason = string(ReasonMention)
		}
		n.Log.Info("pulse notification fanout",
			"orgId", e.OrgID,
			"resourceKind", e.ResourceKind,
			"resourceUID", e.ResourceUID,
			"threadUID", e.ThreadUID,
			"pulseUID", e.PulseUID,
			"recipientUserID", strconv.FormatInt(uid, 10),
			"reason", reason,
			"preview", truncate(e.BodyText, 140),
		)
	}
	return nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
