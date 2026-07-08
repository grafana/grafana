package repository

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-app-sdk/logging"
)

// VerifiedWebhookRequest is an inbound webhook request whose signature has been
// authenticated.
type VerifiedWebhookRequest struct {
	Payload []byte
	Header  http.Header
	// ReplayKey deduplicates retried deliveries; an empty key disables the check.
	ReplayKey string
}

// WebhookEventType classifies a normalized inbound webhook delivery.
type WebhookEventType string

const (
	WebhookEventUnsupported WebhookEventType = "unsupported"
	WebhookEventPing        WebhookEventType = "ping"
	WebhookEventPush        WebhookEventType = "push"
	WebhookEventPullRequest WebhookEventType = "pull_request"
)

type PullRequestAction string

const (
	PullRequestActionOpened   PullRequestAction = "opened"
	PullRequestActionReopened PullRequestAction = "reopened"
	PullRequestActionUpdated  PullRequestAction = "updated"
)

// WebhookEvent is the provider-agnostic form of an inbound webhook delivery.
// A provider's ProcessRequest normalizes its native event into this shape.
type WebhookEvent struct {
	Type         WebhookEventType
	RepoSlug     string
	Branch       string
	DeletedPaths []string
	TotalChanges int
	Action       PullRequestAction
	PRNumber     int
	PRURL        string
	SourceRef    string
	Hash         string
	Message      string
}

// ToCtxLogger returns a context whose logger carries the event's populated fields.
func (e WebhookEvent) ToCtxLogger(ctx context.Context) context.Context {
	args := []any{"type", e.Type}
	if e.Action != "" {
		args = append(args, "action", e.Action)
	}
	if e.RepoSlug != "" {
		args = append(args, "slug", e.RepoSlug)
	}
	if e.Branch != "" {
		args = append(args, "branch", e.Branch)
	}
	if e.PRNumber != 0 {
		args = append(args, "pr", e.PRNumber)
	}
	if e.TotalChanges != 0 {
		args = append(args, "changes", e.TotalChanges)
	}
	return logging.Context(ctx, logging.FromContext(ctx).With(args...))
}
