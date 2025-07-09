// The github package exists to provide a client for the GH API, which can also be faked with a mock.
// In most cases, we want the real client, but testing should mock it, lest we get blocked from their API, or have to configure auth for simple tests.
package github

import (
	"context"
	"errors"
	"time"

	"github.com/google/go-github/v70/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// API errors that we need to convey after parsing real GH errors (or faking them).
var (
	ErrResourceAlreadyExists = errors.New("the resource already exists")
	ErrResourceNotFound      = errors.New("the resource does not exist")
	ErrMismatchedHash        = errors.New("the update cannot be applied because the expected and actual hashes are unequal")
	ErrNoSecret              = errors.New("new webhooks must have a secret")
	//lint:ignore ST1005 this is not punctuation
	ErrPathTraversalDisallowed = errors.New("the path contained ..") //nolint:staticcheck
	ErrServiceUnavailable      = apierrors.NewServiceUnavailable("github is unavailable")
	ErrFileTooLarge            = errors.New("file exceeds maximum allowed size")
	ErrTooManyItems            = errors.New("maximum number of items exceeded")
)

// MaxFileSize maximum file size limit (10MB)
const MaxFileSize = 10 * 1024 * 1024 // 10MB in bytes

type ErrRateLimited = github.RateLimitError

//go:generate mockery --name Client --structname MockClient --inpackage --filename mock_client.go --with-expecter
type Client interface {
	// TODO: remove this
	// IsAuthenticated checks if the client is authenticated.
	IsAuthenticated(ctx context.Context) error

	// Commits returns the commits for the given path
	Commits(ctx context.Context, owner, repository, path, branch string) ([]Commit, error)

	// TODO: remove this
	// RepoExists checks if a repository exists.
	RepoExists(ctx context.Context, owner, repository string) (bool, error)

	// TODO: remove this
	// CreateBranch creates a new branch in the repository.
	CreateBranch(ctx context.Context, owner, repository, sourceBranch, branchName string) error
	// BranchExists checks if a branch exists in the repository.
	// TODO: remove this
	BranchExists(ctx context.Context, owner, repository, branchName string) (bool, error)

	ListWebhooks(ctx context.Context, owner, repository string) ([]WebhookConfig, error)
	CreateWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) (WebhookConfig, error)
	GetWebhook(ctx context.Context, owner, repository string, webhookID int64) (WebhookConfig, error)
	DeleteWebhook(ctx context.Context, owner, repository string, webhookID int64) error
	EditWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) error

	ListPullRequestFiles(ctx context.Context, owner, repository string, number int) ([]CommitFile, error)
	CreatePullRequestComment(ctx context.Context, owner, repository string, number int, body string) error
}

//go:generate mockery --name RepositoryContent --structname MockRepositoryContent --inpackage --filename mock_repository_content.go --with-expecter
type RepositoryContent interface {
	// Returns true if this is a directory, false if it is a file.
	IsDirectory() bool
	// Returns the contents of the file. Decoding happens if necessary.
	// Returns an error if the content represents a directory.
	GetFileContent() (string, error)
	// Returns true if this is a symlink.
	// If true, GetPath returns the path where this symlink leads.
	IsSymlink() bool
	// Returns the full path from the root of the repository.
	// This has no leading or trailing slashes.
	// The path only uses '/' for directories. You can use the 'path' package to interact with these.
	GetPath() string
	// Get the SHA hash. This is usually a SHA-256, but may also be SHA-512.
	// Directories have SHA hashes, too (TODO: how is this calculated?).
	GetSHA() string
	// The size of the file. Not necessarily non-zero, even if the file is supposed to be non-zero.
	GetSize() int64
}

type Branch struct {
	Name string
	Sha  string
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

type FileComment struct {
	Content  string
	Path     string
	Position int
	Ref      string
}

type CreateFileOptions struct {
	// The message of the commit. May be empty, in which case a default value is entered.
	Message string
	// The content of the file to write, unencoded.
	Content []byte
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
