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
	// IsAuthenticated checks if the client is authenticated.
	IsAuthenticated(ctx context.Context) error

	// GetContents returns the metadata and content of a file or directory.
	// When a file is checked, the first returned value will have a value. For a directory, the second will. The other value is always nil.
	// If an error occurs, the returned values may or may not be nil.
	//
	// If ".." appears in the "path", this method will return an error.
	GetContents(ctx context.Context, owner, repository, path, ref string) (fileContents RepositoryContent, dirContents []RepositoryContent, err error)

	// GetTree returns the Git tree in the repository.
	// When recursive is given, subtrees are mapped into the returned array.
	// When basePath is given, only trees under it are given. The results do not include this path in their names.
	//
	// The truncated bool will be set to true if the tree is larger than 7 MB or 100 000 entries.
	// When truncated is true, you may wish to read each subtree manually instead.
	GetTree(ctx context.Context, owner, repository, basePath, ref string, recursive bool) (entries []RepositoryContent, truncated bool, err error)

	// CreateFile creates a new file in the repository under the given path.
	// The file is created on the branch given.
	// The message given is the commit message. If none is given, an appropriate default is used.
	// The content is what the file should contain. An empty slice is valid, though often not very useful.
	//
	// If ".." appears in the "path", this method will return an error.
	CreateFile(ctx context.Context, owner, repository, path, branch, message string, content []byte) error

	// UpdateFile updates a file in the repository under the given path.
	// The file is updated on the branch given.
	// The message given is the commit message. If none is given, an appropriate default is used.
	// The content is what the file should contain. An empty slice is valid, though often not very useful.
	// If the path does not exist, an error is returned.
	// The hash given must be the SHA hash of the file contents. Calling GetContents in advance is an easy way of handling this.
	//
	// If ".." appears in the "path", this method will return an error.
	UpdateFile(ctx context.Context, owner, repository, path, branch, message, hash string, content []byte) error

	// DeleteFile deletes a file in the repository under the given path.
	// The file is deleted from the branch given.
	// The message given is the commit message. If none is given, an appropriate default is used.
	// If the path does not exist, an error is returned.
	// The hash given must be the SHA hash of the file contents. Calling GetContents in advance is an easy way of handling this.
	//
	// If ".." appears in the "path", this method will return an error.
	DeleteFile(ctx context.Context, owner, repository, path, branch, message, hash string) error

	// Commits returns the commits for the given path
	Commits(ctx context.Context, owner, repository, path, branch string) ([]Commit, error)

	// CompareCommits returns the changes between two commits.
	CompareCommits(ctx context.Context, owner, repository, base, head string) ([]CommitFile, error)

	// RepoExists checks if a repository exists.
	RepoExists(ctx context.Context, owner, repository string) (bool, error)

	// CreateBranch creates a new branch in the repository.
	CreateBranch(ctx context.Context, owner, repository, sourceBranch, branchName string) error
	// BranchExists checks if a branch exists in the repository.
	BranchExists(ctx context.Context, owner, repository, branchName string) (bool, error)
	// GetBranch returns the branch of the repository.
	GetBranch(ctx context.Context, owner, repository, branchName string) (Branch, error)

	ListWebhooks(ctx context.Context, owner, repository string) ([]WebhookConfig, error)
	CreateWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) (WebhookConfig, error)
	GetWebhook(ctx context.Context, owner, repository string, webhookID int64) (WebhookConfig, error)
	DeleteWebhook(ctx context.Context, owner, repository string, webhookID int64) error
	EditWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) error

	ListPullRequestFiles(ctx context.Context, owner, repository string, number int) ([]CommitFile, error)
	CreatePullRequestComment(ctx context.Context, owner, repository string, number int, body string) error
	CreatePullRequestFileComment(ctx context.Context, owner, repository string, number int, comment FileComment) error
	ClearAllPullRequestFileComments(ctx context.Context, owner, repository string, number int) error
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
