package repository

import (
	"context"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// FIXME: the name of the mock is different because there is another generated mock for Repository
// I don't know how it got generated.
//
//go:generate mockery --name Repository --structname MockConfigRepository --inpackage --filename config_repository_mock.go --with-expecter
type Repository interface {
	// Config returns the saved Kubernetes object.
	Config() *provisioning.Repository

	// Test checks if the connection information actually works.
	Test(ctx context.Context) (*provisioning.TestResults, error)
}

// ErrFileNotFound indicates that a path could not be found in the repository.
var ErrFileNotFound error = &apierrors.StatusError{ErrStatus: metav1.Status{
	Status:  metav1.StatusFailure,
	Code:    http.StatusNotFound,
	Reason:  metav1.StatusReasonNotFound,
	Message: "file not found",
}}

var ErrRefNotFound error = &apierrors.StatusError{ErrStatus: metav1.Status{
	Status:  metav1.StatusFailure,
	Code:    http.StatusNotFound,
	Reason:  metav1.StatusReasonNotFound,
	Message: "ref not found",
}}

var ErrFileAlreadyExists error = &apierrors.StatusError{ErrStatus: metav1.Status{
	Status:  metav1.StatusFailure,
	Code:    http.StatusConflict,
	Reason:  metav1.StatusReasonAlreadyExists,
	Message: "file already exists",
}}

// ErrUnauthorized indicates that authentication credentials are invalid or missing.
var ErrUnauthorized error = &apierrors.StatusError{ErrStatus: metav1.Status{
	Status:  metav1.StatusFailure,
	Code:    http.StatusUnauthorized,
	Reason:  metav1.StatusReasonUnauthorized,
	Message: "authentication failed",
}}

// ErrPermissionDenied indicates that the authenticated user lacks required permissions.
var ErrPermissionDenied error = &apierrors.StatusError{ErrStatus: metav1.Status{
	Status:  metav1.StatusFailure,
	Code:    http.StatusForbidden,
	Reason:  metav1.StatusReasonForbidden,
	Message: "permission denied",
}}

// ErrServerUnavailable indicates that the remote server is unavailable or returned a 5xx error.
var ErrServerUnavailable error = &apierrors.StatusError{ErrStatus: metav1.Status{
	Status:  metav1.StatusFailure,
	Code:    http.StatusServiceUnavailable,
	Reason:  metav1.StatusReasonServiceUnavailable,
	Message: "server unavailable",
}}

// ErrTooManyItems indicates that pagination limits were exceeded.
var ErrTooManyItems error = &apierrors.StatusError{ErrStatus: metav1.Status{
	Status:  metav1.StatusFailure,
	Code:    http.StatusBadRequest,
	Reason:  metav1.StatusReasonBadRequest,
	Message: "maximum number of items exceeded",
}}

var ErrRepositoryMismatch = apierrors.NewBadRequest("repository mismatch")

// ErrInvalidRef indicates that a provided git ref (branch or commit SHA) failed validation.
var ErrInvalidRef = apierrors.NewBadRequest("invalid ref")

type FileInfo struct {
	// Path to the file on disk.
	// No leading or trailing slashes will be contained within.
	// This uses '/' for separation. Use the 'path' package to interact with this.
	Path string
	// The raw bytes
	Data []byte
	// The git branch or reference commit
	Ref string
	// The git hash for a given file
	Hash string
	// When was the file changed (if known)
	Modified *metav1.Time
}

// An entry in the file tree, as returned by 'ReadFileTree'. Like FileInfo, but contains less information.
type FileTreeEntry struct {
	// The path to the file from the base path given (if any).
	// No leading or trailing slashes will be contained within.
	// This uses '/' for separation. Use the 'path' package to interact with this.
	Path string
	// The hash for the file. Lower-case hex.
	// Empty string if Blob is false.
	Hash string
	// The size of the file.
	// 0 if Blob is false.
	Size int64
	// Whether this entry is a blob or a subtree.
	Blob bool
}

//go:generate mockery --name Reader --structname MockReader --inpackage --filename reader_mock.go --with-expecter
type Reader interface {
	Repository

	// Read a file from the resource
	// This data will be parsed and validated before it is shown to end users
	Read(ctx context.Context, path, ref string) (*FileInfo, error)

	// Read all file names from the tree.
	// This data will be parsed and validated before it is shown.
	//
	// TODO: Make some API contract that lets us ignore files that aren't relevant to us (e.g. CI/CD, CODEOWNERS, other configs or source code).
	// TODO: Test scale: do we want to stream entries instead somehow?
	ReadTree(ctx context.Context, ref string) ([]FileTreeEntry, error)
}

type Writer interface {
	Repository

	// Write a file to the repository.
	// The data has already been validated and is ready for save
	Create(ctx context.Context, path, ref string, data []byte, message string) error

	// Update a file in the remote repository
	// The data has already been validated and is ready for save
	Update(ctx context.Context, path, ref string, data []byte, message string) error

	// Write a file to the repository.
	// Functionally the same as Read then Create or Update, but more efficient depending on the backend
	Write(ctx context.Context, path, ref string, data []byte, message string) error

	// Delete a file in the remote repository
	Delete(ctx context.Context, path, ref, message string) error

	// Move a file from one path to another in the remote repository
	Move(ctx context.Context, oldPath, newPath, ref, message string) error
}

//go:generate mockery --name ReaderWriter --structname MockReaderWriter --inpackage --filename reader_writer_mock.go --with-expecter
type ReaderWriter interface {
	Reader
	Writer
}

// SizeLimitedReader is an optional interface implemented by concrete repository
// types that support per-read file size enforcement. WithMaxFileSize stores the
// limit atomically so the next Read rejects payloads exceeding maxBytes.
// Because it mutates in place, the caller keeps the same concrete type and all
// optional interface assertions (Versioned, StageableRepository, …) stay valid.
type SizeLimitedReader interface {
	Reader
	WithMaxFileSize(maxBytes int64)
}

//go:generate mockery --name RepositoryWithURLs --structname MockRepositoryWithURLs --inpackage --filename repository_with_urls_mock.go --with-expecter
type RepositoryWithURLs interface {
	Repository

	// Get resource URLs for a file inside a repository
	ResourceURLs(ctx context.Context, file *FileInfo) (*provisioning.RepositoryURLs, error)
	RefURLs(ctx context.Context, ref string) (*provisioning.RepositoryURLs, error)
}

// WebhookRepository is implemented by repositories that can receive and handle
// incoming webhook requests from their git provider.
//
//go:generate mockery --name WebhookRepository --structname MockWebhookRepository --inpackage --filename webhook_repository_mock.go --with-expecter
type WebhookRepository interface {
	Repository

	// Slug is the repository the webhook is configured for; the dispatcher uses
	// it to reject events for anything else.
	Slug() string

	// VerifyRequest authenticates the inbound request and returns its verified form.
	VerifyRequest(req *http.Request) (*VerifiedWebhookRequest, error)

	// ProcessRequest normalizes an already-verified request into an event.
	ProcessRequest(ctx context.Context, req *VerifiedWebhookRequest) (WebhookEvent, error)

	WebhookClient() WebhookClient
	WebhookURL() string
	SubscribedEvents() []string
}

type FileAction string

const (
	FileActionCreated FileAction = "created"
	FileActionUpdated FileAction = "updated"
	FileActionDeleted FileAction = "deleted"
	FileActionIgnored FileAction = "ignored"

	// Renamed actions may be reconstructed as delete then create
	FileActionRenamed FileAction = "renamed"
)

type VersionedFileChange struct {
	Action FileAction
	Path   string

	Ref          string
	PreviousRef  string // rename | update
	PreviousPath string // rename
}

// Versioned is a repository that supports versioning.
// This interface may be extended to make the the original Repository interface more agnostic to the underlying storage system.
//
//go:generate mockery --name Versioned --structname MockVersioned --inpackage --filename versioned_mock.go --with-expecter
type Versioned interface {
	// History of changes for a path
	History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error)
	LatestRef(ctx context.Context) (string, error)
	ListRefs(ctx context.Context) ([]provisioning.RefItem, error)
	CompareFiles(ctx context.Context, base, ref string) ([]VersionedFileChange, error)
}

// BranchHandler is a repository that supports making actions on branches.
type BranchHandler interface {
	GetDefaultBranch(ctx context.Context) (string, error)
	GetCurrentBranch() string
	SetBranch(branch string)
}

// PullRequestRepo is implemented by repositories that can be evaluated and
// commented on as part of a pull request preview job.
//
//go:generate mockery --name PullRequestRepo --structname MockPullRequestRepo --inpackage --filename pull_request_repo_mock.go --with-expecter
type PullRequestRepo interface {
	Config() *provisioning.Repository
	Read(ctx context.Context, path, ref string) (*FileInfo, error)
	MergeBase(ctx context.Context, headRef string) (string, error)
	CompareFiles(ctx context.Context, base, ref string) ([]VersionedFileChange, error)
	CommentPullRequest(ctx context.Context, prNumber int, comment string) error
}
