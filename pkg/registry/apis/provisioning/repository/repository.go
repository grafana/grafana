package repository

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

var ErrFileNotFound error = fs.ErrNotExist

// UndoFunc is a function that can be called to undo a previous operation
type UndoFunc func(context.Context) error

// Chain is a helper function to chain UndoFuncs together
func (f UndoFunc) Chain(ctx context.Context, next UndoFunc) UndoFunc {
	return func(ctx context.Context) error {
		if err := f(ctx); err != nil {
			return err
		}
		return next(ctx)
	}
}

type FileInfo struct {
	// Path to the file on disk
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

type Repository interface {
	// The saved Kubernetes object.
	Config() *provisioning.Repository

	// This is called before trying to create/update a saved resource
	// This is not an indication that the connection information works,
	// just that they are reasonably configured
	Validate() field.ErrorList

	// Called to check if all connection information actually works
	Test(ctx context.Context, logger *slog.Logger) error

	// Read a file from the resource
	// This data will be parsed and validated before it is shown to end users
	Read(ctx context.Context, logger *slog.Logger, path, ref string) (*FileInfo, error)

	// Read all file names from the tree.
	// This data will be parsed and validated before it is shown.
	//
	// TODO: Make some API contract that lets us ignore files that aren't relevant to us (e.g. CI/CD, CODEOWNERS, other configs or source code).
	// TODO: Test scale: do we want to stream entries instead somehow?
	ReadTree(ctx context.Context, logger *slog.Logger, ref string) ([]FileTreeEntry, error)

	// Write a file to the repository.
	// The data has already been validated and is ready for save
	Create(ctx context.Context, logger *slog.Logger, path, ref string, data []byte, message string) error

	// Update a file in the remote repository
	// The data has already been validated and is ready for save
	Update(ctx context.Context, logger *slog.Logger, path, ref string, data []byte, message string) error

	// Delete a file in the remote repository
	Delete(ctx context.Context, logger *slog.Logger, path, ref, message string) error

	// For repositories that support webhooks
	Webhook(ctx context.Context, logger *slog.Logger, responder rest.Responder, factory FileReplicatorFactory) http.HandlerFunc
	// Hooks called after the repository has been created, updated or deleted
	AfterCreate(ctx context.Context, logger *slog.Logger) error
	BeginUpdate(ctx context.Context, logger *slog.Logger, old Repository) (UndoFunc, error)
	AfterDelete(ctx context.Context, logger *slog.Logger) error
}

// FileReplicator is an interface for replicating files
type FileReplicator interface {
	Validate(ctx context.Context, fileInfo *FileInfo) (bool, error)
	Replicate(ctx context.Context, fileInfo *FileInfo) error
	Delete(ctx context.Context, fileInfo *FileInfo) error
}

// FileReplicatorFactory is an interface for creating FileReplicators
type FileReplicatorFactory interface {
	New() (FileReplicator, error)
}
