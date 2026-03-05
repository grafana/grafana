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
// NOTE: These are deprecated in favor of using common repository errors from the repository package.
// They're kept for backward compatibility with existing code.
var (
	ErrResourceNotFound   = errors.New("the resource does not exist")
	ErrUnauthorized       = errors.New("unauthorized")
	ErrServiceUnavailable = apierrors.NewServiceUnavailable("github is unavailable")
	ErrTooManyItems       = errors.New("maximum number of items exceeded")
)

//go:generate mockery --name Client --structname MockClient --inpackage --filename mock_client.go --with-expecter
type Client interface {
	// Repositories
	GetRepository(ctx context.Context, owner, repository string) (Repository, error)

	// Branch protection
	GetBranchProtection(ctx context.Context, owner, repository, branch string) (*BranchProtection, error)

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

type Repository struct {
	ID            int64
	Name          string
	DefaultBranch string
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

// BranchProtection holds the subset of GitHub branch protection rules
// that unambiguously prevent direct pushes to a branch.
//
// These fields map to the GitHub "Branch protection" settings documented at:
// https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
//
// Only rules that unconditionally block `git push` are tracked here.
// Other settings like required status checks, push restrictions, or enforce
// admins are intentionally omitted: status checks primarily gate PR merges
// (not pushes), restrictions depend on the identity of the pushing actor,
// and enforce admins is a modifier of other rules rather than a standalone blocker.
type BranchProtection struct {
	// RequiredPullRequestReviews is true when "Require a pull request before merging"
	// is enabled. All changes must go through a PR — GitHub rejects direct pushes
	// with a 403.
	//
	// Detection: the GitHub API returns a non-nil `required_pull_request_reviews`
	// object only when this setting is on, so a nil check is sufficient.
	RequiredPullRequestReviews bool

	// LockBranch is true when "Lock branch" is enabled. The branch becomes fully
	// read-only — no commits can be pushed by anyone, regardless of permissions.
	//
	// Detection: the API can return a `lock_branch` wrapper with `enabled: false`,
	// so we check both non-nil AND the enabled flag.
	LockBranch bool
}

// BlocksDirectPush returns human-readable reasons why direct pushes would be
// blocked by branch protection rules. A nil slice means no blocking rules were
// detected.
func (bp *BranchProtection) BlocksDirectPush() []string {
	if bp == nil {
		return nil
	}

	var reasons []string
	if bp.RequiredPullRequestReviews {
		reasons = append(reasons, "required pull request reviews")
	}
	if bp.LockBranch {
		reasons = append(reasons, "branch is locked (read-only)")
	}
	return reasons
}
