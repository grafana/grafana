package provisioning

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

var _ Repository = &localRepository{}

type localRepository struct {
	config      provisioning.Repository
	validFolder func(string) bool
}

// Validate implements provisioning.Repository.
func (r *localRepository) Validate() (fields field.ErrorList) {
	if r.config.Spec.Type != provisioning.LocalRepositoryType {
		fields = append(fields, &field.Error{
			Type:   field.ErrorTypeInvalid,
			Field:  "spec.type",
			Detail: "Local repository requires spec.type=local",
		})
	}

	cfg := r.config.Spec.Local
	if cfg == nil {
		fields = append(fields, &field.Error{
			Type:  field.ErrorTypeRequired,
			Field: "spec.local",
		})
		return fields
	}

	// The path value must be set for local provisioning
	if cfg.Path == "" {
		fields = append(fields, &field.Error{
			Type:  field.ErrorTypeRequired,
			Field: "spec.local.path",
		})
		return fields
	}

	if !r.validFolder(cfg.Path) {
		fields = append(fields, &field.Error{
			Type:     field.ErrorTypeTypeInvalid,
			Field:    "spec.local.path",
			BadValue: cfg.Path,
			Detail:   "Not allowed to provision from this path",
		})
		return fields
	}

	return fields
}

// Test implements provisioning.Repository.
func (r *localRepository) Test(ctx context.Context) error {
	return &errors.StatusError{
		ErrStatus: v1.Status{
			Message: "test is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// ReadResource implements provisioning.Repository.
func (r *localRepository) ReadResource(ctx context.Context, path string, commit string) (*provisioning.ResourceWrapper, error) {
	return nil, &errors.StatusError{
		ErrStatus: v1.Status{
			Message: "read resource is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// Webhook implements provisioning.Repository.
func (r *localRepository) Webhook() http.HandlerFunc {
	// webhooks are not supported with local
	return nil
}
