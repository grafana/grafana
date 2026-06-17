package repository

import (
	"context"
)

type WebhookClient interface {
	CreateWebhook(ctx context.Context, hook Webhook) (Webhook, error)
	GetWebhook(ctx context.Context, webhookID int64) (Webhook, error)
	EditWebhook(ctx context.Context, hook Webhook) error
	DeleteWebhook(ctx context.Context, webhookID int64) error
}

type PullRequestClient interface {
	CreatePullRequestComment(ctx context.Context, prNumber int, body string) error
}

type jointClient interface {
	WebhookClient
	PullRequestClient
}
