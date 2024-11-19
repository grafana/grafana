package provisioning

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type RepoGetter interface {
	GetRepository(ctx context.Context, name string) (Repository, error)
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
	Write(ctx context.Context, path string, data []byte, comment string) error

	// Delete a file in the remote repository
	Delete(ctx context.Context, path string, comment string) error

	// For repositories that support webhooks
	Webhook() http.HandlerFunc
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
		ErrStatus: v1.Status{
			Message: "test is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// ReadResource implements provisioning.Repository.
func (r *unknownRepository) Read(ctx context.Context, path string, commit string) ([]byte, error) {
	return nil, &errors.StatusError{
		ErrStatus: v1.Status{
			Message: "read resource is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Write(ctx context.Context, path string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: v1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Delete(ctx context.Context, path string, comment string) error {
	return &errors.StatusError{
		ErrStatus: v1.Status{
			Message: "delete file not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// Webhook implements provisioning.Repository.
func (r *unknownRepository) Webhook() http.HandlerFunc {
	// webhooks are not supported with local
	return nil
}
