package repository

import (
	"context"
	"log/slog"
	"net/http"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
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
func (r *unknownRepository) Test(ctx context.Context, logger *slog.Logger) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "test is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// ReadResource implements provisioning.Repository.
func (r *unknownRepository) Read(ctx context.Context, logger *slog.Logger, path, ref string) (*FileInfo, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "read resource is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Create(ctx context.Context, logger *slog.Logger, path, ref string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Update(ctx context.Context, logger *slog.Logger, path, ref string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *unknownRepository) Delete(ctx context.Context, logger *slog.Logger, path, ref, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "delete file not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// Webhook implements provisioning.Repository.
func (r *unknownRepository) Webhook(ctx context.Context, logger *slog.Logger, responder rest.Responder) http.HandlerFunc {
	// webhooks are not supported with local
	return nil
}

func (r *unknownRepository) AfterCreate(ctx context.Context, logger *slog.Logger) error {
	return nil
}

func (r *unknownRepository) BeginUpdate(ctx context.Context, logger *slog.Logger, old Repository) (UndoFunc, error) {
	return nil, nil
}

func (r *unknownRepository) AfterDelete(ctx context.Context, logger *slog.Logger) error {
	return nil
}
