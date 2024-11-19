package provisioning

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type LocalFolderResolver struct {
	// Local path to data directory
	ProvisioningPath string

	// Path to development environment
	DevenvPath string
}

func (r *LocalFolderResolver) LocalPath(path string) string {
	// Ignore anything with funky path names
	if strings.Contains(path, "..") {
		return ""
	}

	parts := strings.SplitN(path, "/", 2)
	if len(parts) != 2 {
		return ""
	}
	switch parts[0] {
	case "provisioning":
		if r.ProvisioningPath == "" {
			return "" // not allowed
		}
		return filepath.Join(r.ProvisioningPath, parts[1])

	case "devenv":
		if r.DevenvPath == "" {
			return "" // not allowed
		}
		return filepath.Join(r.DevenvPath, parts[1])
	}
	return ""
}

var _ Repository = (*localRepository)(nil)

type localRepository struct {
	config *provisioning.Repository

	// validated path that can be read if not empty
	path string
}

func newLocalRepository(config *provisioning.Repository, resolver *LocalFolderResolver) *localRepository {
	r := &localRepository{
		config: config,
	}
	if config.Spec.Local != nil {
		r.path = resolver.LocalPath(config.Spec.Local.Path)
	}
	return r
}

func (r *localRepository) Config() *provisioning.Repository {
	return r.config
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
		fields = append(fields, field.Required(field.NewPath("spec", "local", "path"),
			"must enter a path to local file"))
	} else if r.path == "" {
		fields = append(fields, field.Invalid(field.NewPath("spec", "local", "path"),
			cfg.Path, "configured path is not allowed, see system allow list"))
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
func (r *localRepository) Read(ctx context.Context, path string, commit string) ([]byte, error) {
	if commit != "" {
		return nil, errors.NewBadRequest("local repository does not support commits")
	}
	if r.path == "" {
		return nil, &errors.StatusError{
			ErrStatus: v1.Status{
				Message: "the service is missing a root path",
				Code:    http.StatusFailedDependency,
			},
		}
	}

	//nolint:gosec
	return os.ReadFile(filepath.Join(r.path, path))
}

func (r *localRepository) Write(ctx context.Context, path string, data []byte, comment string) error {
	if r.path == "" {
		return &errors.StatusError{
			ErrStatus: v1.Status{
				Message: "the service is missing a root path",
				Code:    http.StatusFailedDependency,
			},
		}
	}

	return os.WriteFile(filepath.Join(r.path, path), data, 0600)
}

func (r *localRepository) Delete(ctx context.Context, path string, comment string) error {
	if r.path == "" {
		return &errors.StatusError{
			ErrStatus: v1.Status{
				Message: "the service is missing a root path",
				Code:    http.StatusFailedDependency,
			},
		}
	}

	return os.Remove(filepath.Join(r.path, path))
}

// Webhook implements provisioning.Repository.
func (r *localRepository) Webhook() http.HandlerFunc {
	// webhooks are not supported with local
	return nil
}
