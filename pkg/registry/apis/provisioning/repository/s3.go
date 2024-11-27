package repository

import (
	"context"
	"log/slog"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type s3Repository struct {
	config *provisioning.Repository
}

var _ Repository = (*s3Repository)(nil)

func NewS3(config *provisioning.Repository) *s3Repository {
	return &s3Repository{config}
}

func (r *s3Repository) Config() *provisioning.Repository {
	return r.config
}

// Validate implements provisioning.Repository.
func (r *s3Repository) Validate() (list field.ErrorList) {
	s3 := r.Config().Spec.S3
	if s3 == nil {
		list = append(list, field.Required(field.NewPath("spec", "s3"), "an s3 config is required"))
		return
	}
	if s3.Region == "" {
		list = append(list, field.Required(field.NewPath("spec", "s3", "region"), "an s3 region is required"))
	}
	if s3.Bucket == "" {
		list = append(list, field.Required(field.NewPath("spec", "s3", "bucket"), "an s3 bucket name is required"))
	}
	return
}

// Test implements provisioning.Repository.
func (r *s3Repository) Test(ctx context.Context, logger *slog.Logger) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "test is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// ReadResource implements provisioning.Repository.
func (r *s3Repository) Read(ctx context.Context, logger *slog.Logger, path string, ref string) (*FileInfo, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "read resource is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *s3Repository) ReadTree(ctx context.Context, logger *slog.Logger, ref string) ([]FileTreeEntry, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "read file tree resource is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *s3Repository) Create(ctx context.Context, logger *slog.Logger, path string, ref string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *s3Repository) Update(ctx context.Context, logger *slog.Logger, path string, ref string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *s3Repository) Delete(ctx context.Context, logger *slog.Logger, path string, ref string, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "delete file not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// Webhook implements provisioning.Repository.
func (r *s3Repository) Webhook(ctx context.Context, logger *slog.Logger, responder rest.Responder) http.HandlerFunc {
	// webhooks are not supported with local
	return nil
}

func (r *s3Repository) AfterCreate(ctx context.Context, logger *slog.Logger) error {
	return nil
}

func (r *s3Repository) BeginUpdate(ctx context.Context, logger *slog.Logger, old Repository) (UndoFunc, error) {
	return func(ctx context.Context) error { return nil }, nil
}

func (r *s3Repository) AfterDelete(ctx context.Context, logger *slog.Logger) error {
	return nil
}
