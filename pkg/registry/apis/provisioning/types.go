package provisioning

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type RepoGetter interface {
	GetRepository(ctx context.Context, name string) (Repository, error)
}

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

type Repository interface {
	// The saved object
	Config() *provisioning.Repository

	// This is called before trying to create/update a saved resource
	// This is not an indication that the connection information works,
	// just that they are reasonably configured
	Validate() field.ErrorList

	// Called to check if all connection information actually works
	Test(ctx context.Context) error

	// Read a file from the resource
	// This data will be parsed and validated before it is shown to end users
	Read(ctx context.Context, path string, commit string) ([]byte, error)

	// Write a file to the repository.
	// The data has already been validated and is ready for save
	Create(ctx context.Context, path string, data []byte, comment string) error

	// Update a file in the remote repository
	// The data has already been validated and is ready for save
	Update(ctx context.Context, path string, data []byte, comment string) error

	// Delete a file in the remote repository
	Delete(ctx context.Context, path string, comment string) error

	// For repositories that support webhooks
	Webhook(responder rest.Responder) http.HandlerFunc

	// Hooks called after the repository has been created, updated or deleted
	AfterCreate(ctx context.Context) error
	BeginUpdate(ctx context.Context, old Repository) (UndoFunc, error)
	AfterDelete(ctx context.Context) error
}

var _ Repository = (*unknownRepository)(nil)

type unknownRepository struct {
	config *provisioning.Repository
}

func (r *unknownRepository) Config() *provisioning.Repository {
	return r.config
}

// Validate implements provisioning.Repository.
func (r *unknownRepository) Validate() (fields field.ErrorList) {
	if r.config.Spec.Type == "" {
		return field.ErrorList{
			field.Required(field.NewPath("spec", "type"), "must specify a repository type"),
		}
	}
	return field.ErrorList{
		field.Invalid(field.NewPath("spec", "type"), r.config.Spec.Type, "unsupported repository type"),
	}
}

// Test implements provisioning.Repository.
func (r *unknownRepository) Test(ctx context.Context) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "test is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// ReadResource implements provisioning.Repository.
func (r *unknownRepository) Read(ctx context.Context, path string, commit string) ([]byte, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "read resource is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Create(ctx context.Context, path string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Update(ctx context.Context, path string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Delete(ctx context.Context, path string, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "delete file not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// Webhook implements provisioning.Repository.
func (r *unknownRepository) Webhook(responder rest.Responder) http.HandlerFunc {
	// webhooks are not supported with local
	return nil
}

func (r *unknownRepository) AfterCreate(ctx context.Context) error {
	return nil
}

func (r *unknownRepository) BeginUpdate(ctx context.Context, old Repository) (UndoFunc, error) {
	return nil, nil
}

func (r *unknownRepository) AfterDelete(ctx context.Context) error {
	return nil
}
