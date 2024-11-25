package repository

import (
	"context"
	"io/fs"
	"net/http"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
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

type Repository interface {
	// The saved Kubernetes object.
	Config() *provisioning.Repository

	// This is called before trying to create/update a saved resource
	// This is not an indication that the connection information works,
	// just that they are reasonably configured
	Validate() field.ErrorList

	// Called to check if all connection information actually works
	Test(ctx context.Context) error

	// Read a file from the resource
	// This data will be parsed and validated before it is shown to end users
	Read(ctx context.Context, path, ref string) (*FileInfo, error)

	// Write a file to the repository.
	// The data has already been validated and is ready for save
	Create(ctx context.Context, path, ref string, data []byte, comment string) error

	// Update a file in the remote repository
	// The data has already been validated and is ready for save
	Update(ctx context.Context, path, ref string, data []byte, comment string) error

	// Delete a file in the remote repository
	Delete(ctx context.Context, path, ref, comment string) error

	// For repositories that support webhooks
	Webhook(responder rest.Responder) http.HandlerFunc

	// Hooks called after the repository has been created, updated or deleted
	AfterCreate(ctx context.Context) error
	BeginUpdate(ctx context.Context, old Repository) (UndoFunc, error)
	AfterDelete(ctx context.Context) error
}
