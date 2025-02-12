package repository

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

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
func (r *s3Repository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "test is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// ReadResource implements provisioning.Repository.
func (r *s3Repository) Read(ctx context.Context, path string, ref string) (*FileInfo, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "read resource is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *s3Repository) ReadTree(ctx context.Context, ref string) ([]FileTreeEntry, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "read file tree resource is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *s3Repository) Create(ctx context.Context, path string, ref string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *s3Repository) Update(ctx context.Context, path string, ref string, data []byte, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "write file is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *s3Repository) Delete(ctx context.Context, path string, ref string, comment string) error {
	return &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "delete file not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func (r *s3Repository) Write(ctx context.Context, path string, ref string, data []byte, message string) error {
	return writeWithReadThenCreateOrUpdate(ctx, r, path, ref, data, message)
}

func (r *s3Repository) History(ctx context.Context, path string, ref string) ([]provisioning.HistoryItem, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Message: "history is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// Webhook implements Repository.
func (r *s3Repository) Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error) {
	return nil, &errors.StatusError{
		ErrStatus: metav1.Status{
			Code:    http.StatusNotImplemented,
			Message: "webhook not implemented",
		},
	}
}
