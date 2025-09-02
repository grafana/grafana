// The github package exists to provide a client for the GH API, which can also be faked with a mock.
// In most cases, we want the real client, but testing should mock it, lest we get blocked from their API, or have to configure auth for simple tests.
package github

import (
	"context"
	"errors"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// API errors that we need to convey after parsing real GH errors (or faking them).
var (
	ErrResourceNotFound = errors.New("the resource does not exist")
	//lint:ignore ST1005 this is not punctuation
	ErrServiceUnavailable = apierrors.NewServiceUnavailable("github is unavailable")
	ErrTooManyItems       = errors.New("maximum number of items exceeded")
)

//go:generate mockery --name Client --structname MockClient --inpackage --filename mock_client.go --with-expecter
type Client interface {
	// Commits
	Commits(ctx context.Context, owner, repository, path, branch string) ([]Commit, error)

	// Webhooks
	ListWebhooks(ctx context.Context, owner, repository string) ([]WebhookConfig, error)
	CreateWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) (WebhookConfig, error)
	GetWebhook(ctx context.Context, owner, repository string, webhookID int64) (WebhookConfig, error)
	DeleteWebhook(ctx context.Context, owner, repository string, webhookID int64) error
	EditWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) error

	// Pull requests
	ListPullRequestFiles(ctx context.Context, owner, repository string, number int) ([]CommitFile, error)
	CreatePullRequestComment(ctx context.Context, owner, repository string, number int, body string) error
}

type CommitAuthor struct {
	Name      string
	Username  string
	AvatarURL string
}

type Commit struct {
	Ref       string
	Message   string
	Author    *CommitAuthor
	Committer *CommitAuthor
	CreatedAt time.Time
}

//go:generate mockery --name CommitFile --structname MockCommitFile --inpackage --filename mock_commit_file.go --with-expecter
type CommitFile interface {
	GetSHA() string
	GetFilename() string
	GetPreviousFilename() string
	GetStatus() string
}

type WebhookConfig struct {
	// The ID of the webhook.
	// Can be 0 on creation.
	ID int64
	// The events which this webhook shall contact the URL for.
	Events []string
	// Is the webhook enabled?
	Active bool
	// The URL GitHub should contact on events.
	URL string
	// The content type GitHub should send to the URL.
	// If not specified, this is "form".
	ContentType string
	// The secret to use when sending events to the URL.
	// If fetched from GitHub, this is empty as it contains no useful information.
	Secret string
}
