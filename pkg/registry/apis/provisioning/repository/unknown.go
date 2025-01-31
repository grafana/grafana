package repository

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

var _ Repository = (*unknownRepository)(nil)

type unknownRepository struct {
	config *provisioning.Repository
}

func NewUnknown(config *provisioning.Repository) *unknownRepository {
	return &unknownRepository{config}
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
func (r *unknownRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "test is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// ReadResource implements provisioning.Repository.
func (r *unknownRepository) Read(ctx context.Context, path, ref string) (*FileInfo, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "read resource is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) ReadTree(ctx context.Context, ref string) ([]FileTreeEntry, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "read file tree resource is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Create(ctx context.Context, path, ref string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Update(ctx context.Context, path, ref string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Write(ctx context.Context, path string, ref string, data []byte, message string) error {
	return writeWithReadThenCreateOrUpdate(ctx, r, path, ref, data, message)
}

func (r *unknownRepository) Delete(ctx context.Context, path, ref, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "delete file not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "history is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// Webhook implements Repository.
func (r *unknownRepository) Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Code:    http.StatusNotImplemented,
			Message: "webhook not implemented",
		},
	}
}
