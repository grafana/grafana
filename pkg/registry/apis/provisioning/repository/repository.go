package repository

import (
	"context"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// FIXME: the name of the mock is different because there is another generated mock for Repository
// I don't know how it got generated.
//
//go:generate mockery --name Repository --structname MockConfigRepository --inpackage --filename config_repository_mock.go --with-expecter
type Repository interface {
	// Config returns the saved Kubernetes object.
	Config() *provisioning.Repository

	// Validate ensures the resource _looks_ correct.
	// It should be called before trying to upsert a resource into the Kubernetes API server.
	// This is not an indication that the connection information works, just that they are reasonably configured (see also Test).
	Validate() field.ErrorList

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

type ReaderWriter interface {
	Reader
	Writer
}

// Hooks called after the repository has been created, updated or deleted
type RepositoryWithURLs interface {
	Repository

	// Get resource URLs for a file inside a repository
	ResourceURLs(ctx context.Context, file *FileInfo) (*provisioning.ResourceURLs, error)
}

// Hooks called after the repository has been created, updated or deleted
type Hooks interface {
	Repository

	OnCreate(ctx context.Context) ([]map[string]interface{}, error)
	OnUpdate(ctx context.Context) ([]map[string]interface{}, error)
	OnDelete(ctx context.Context) error
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
