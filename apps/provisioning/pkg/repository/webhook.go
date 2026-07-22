package repository

import (
	"context"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

// WebhookConfig is the provider-agnostic representation of a git provider webhook.
// Each provider implements it with its own struct holding the common fields
// plus any provider-specific ones. Identifiers are strings because providers
// disagree on the type: GitHub and GitLab use numeric IDs, Bitbucket uses UUIDs.
//
//go:generate mockery --name WebhookConfig --structname MockWebhookConfig --inpackage --filename mock_webhook_config.go --with-expecter
type WebhookConfig interface {
	GetID() string
	GetURL() string
	GetEvents() []string
	GetSecret() string
	SetURL(url string)
	SetEvents(events []string)
	SetSecret(secret string)
}

//go:generate mockery --name WebhookClient --structname MockWebhookClient --inpackage --filename mock_webhook_client.go --with-expecter
type WebhookClient interface {
	CreateWebhook(ctx context.Context, url string, events []string, secret string) (WebhookConfig, error)
	GetWebhook(ctx context.Context, id WebhookID) (WebhookConfig, error)
	EditWebhook(ctx context.Context, hook WebhookConfig) error
	DeleteWebhook(ctx context.Context, id WebhookID) error
}

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

// WebhookID identifies a provider webhook. Providers disagree on the
// identifier type: GitHub and GitLab use numeric IDs, Bitbucket uses UUIDs.
type WebhookID struct {
	ID   int64
	UUID string
}

func (id WebhookID) IsEmpty() bool {
	return id.ID == 0 && id.UUID == ""
}

func (id WebhookID) String() string {
	if id.UUID != "" {
		return id.UUID
	}
	return strconv.FormatInt(id.ID, 10)
}

// GetID extracts the webhook identifier from a repository's
// webhook status. A nil status yields an empty identifier.
func GetID(status *provisioning.WebhookStatus) WebhookID {
	if status == nil {
		return WebhookID{}
	}
	return WebhookID{ID: status.ID, UUID: status.UUID}
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
