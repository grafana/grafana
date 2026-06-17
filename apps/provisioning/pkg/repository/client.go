package repository

import (
	"context"
)

// ProviderClient is the minimal git provider API surface used by Grafana's
// provisioning integration: managing webhooks and commenting on pull requests.
// Implementations are scoped to a single repository at construction.
type ProviderClient interface {
	CreateWebhook(ctx context.Context, hook Webhook) (Webhook, error)
	GetWebhook(ctx context.Context, webhookID int64) (Webhook, error)
	EditWebhook(ctx context.Context, hook Webhook) error
	DeleteWebhook(ctx context.Context, webhookID int64) error
	CreatePullRequestComment(ctx context.Context, prNumber int, body string) error
}
