package repository

import (
	"context"
	"io/fs"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

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
var ErrFileNotFound error = fs.ErrNotExist

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

type Reader interface {
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
}

// Hooks called after the repository has been created, updated or deleted
type Hooks interface {
	// For repositories that support webhooks
	Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error)
	OnCreate(ctx context.Context) (*provisioning.WebhookStatus, error)
	OnUpdate(ctx context.Context) (*provisioning.WebhookStatus, error)
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
type Versioned interface {
	// History of changes for a path
	History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error)
	LatestRef(ctx context.Context) (string, error)
	CompareFiles(ctx context.Context, base, ref string) ([]VersionedFileChange, error)
}
