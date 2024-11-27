package repository

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"

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

func NewLocal(config *provisioning.Repository, resolver *LocalFolderResolver) *localRepository {
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
func (r *localRepository) Test(ctx context.Context, logger *slog.Logger) error {
	return &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Message: "test is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// ReadResource implements provisioning.Repository.
func (r *localRepository) Read(ctx context.Context, logger *slog.Logger, path string, ref string) (*FileInfo, error) {
	if ref != "" {
		return nil, apierrors.NewBadRequest("local repository does not support ref")
	}
	if r.path == "" {
		return nil, &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Message: "the service is missing a root path",
				Code:    http.StatusFailedDependency,
			},
		}
	}

	fullpath := filepath.Join(r.path, path)
	info, err := os.Stat(fullpath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrFileNotFound
	} else if err != nil {
		return nil, err
	}

	//nolint:gosec
	data, err := os.ReadFile(fullpath)
	if err != nil {
		return nil, err
	}

	hash, _, err := r.calculateFileHash(ctx, fullpath)
	if err != nil {
		return nil, err
	}

	return &FileInfo{
		Path: path,
		Data: data,
		Hash: hash,
		Modified: &metav1.Time{
			Time: info.ModTime(),
		},
	}, nil
}

// ReadResource implements provisioning.Repository.
func (r *localRepository) ReadTree(ctx context.Context, logger *slog.Logger, ref string) ([]FileTreeEntry, error) {
	if ref != "" {
		return nil, apierrors.NewBadRequest("local repository does not support ref")
	}
	if r.path == "" {
		return nil, &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Message: "the service is missing a root path",
				Code:    http.StatusFailedDependency,
			},
		}
	}

	return r.recursivelyReadTree(ctx, r.path)
}

func (r *localRepository) recursivelyReadTree(ctx context.Context, path string) ([]FileTreeEntry, error) {
	osEntries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	entries := make([]FileTreeEntry, 0, len(osEntries))
	for _, oe := range osEntries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		oePath := filepath.Join(path, oe.Name())
		if oe.IsDir() {
			entries = append(entries, FileTreeEntry{
				Path: oePath,
				Hash: "",
				Size: 0,
				Blob: false,
			})
			subEntries, err := r.recursivelyReadTree(ctx, oePath)
			if err != nil {
				return nil, err
			}
			entries = append(entries, subEntries...)
		} else {
			hash, size, err := r.calculateFileHash(ctx, oePath)
			if err != nil {
				return nil, fmt.Errorf("failed to read and calculate hash of path %s: %w", oePath, err)
			}
			entries = append(entries, FileTreeEntry{
				Path: oePath,
				Blob: true,
				Hash: hash,
				Size: size,
			})
		}
	}
	return entries, nil
}

func (r *localRepository) calculateFileHash(ctx context.Context, path string) (string, int64, error) {
	file, err := os.OpenFile(path, os.O_RDONLY, 0)
	if err != nil {
		return "", 0, err
	}

	// TODO: Define what hashing algorithm we want to use for the entire repository. Maybe a config option?
	hasher := sha1.New()
	// TODO: context-aware io.Copy? Is that even possible with a reasonable impl?
	size, err := io.Copy(hasher, file)
	if err != nil {
		return "", 0, err
	}
	// NOTE: EncodeToString (& hex.Encode for that matter) return lower-case hex.
	return hex.EncodeToString(hasher.Sum(nil)), size, nil
}

func (r *localRepository) Create(ctx context.Context, logger *slog.Logger, path string, ref string, data []byte, comment string) error {
	if ref != "" {
		return apierrors.NewBadRequest("local repository does not support ref")
	}

	if r.path == "" {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Message: "the service is missing a root path",
				Code:    http.StatusFailedDependency,
			},
		}
	}

	path = filepath.Join(r.path, path)
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			return err
		}
		return os.WriteFile(path, data, 0600)
	}
	return fmt.Errorf("file already exists")
}

func (r *localRepository) Update(ctx context.Context, logger *slog.Logger, path string, ref string, data []byte, comment string) error {
	if ref != "" {
		return apierrors.NewBadRequest("local repository does not support ref")
	}

	if r.path == "" {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Message: "the service is missing a root path",
				Code:    http.StatusFailedDependency,
			},
		}
	}

	path = filepath.Join(r.path, path)
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("file does not exist")
	}
	return os.WriteFile(path, data, 0600)
}

func (r *localRepository) Delete(ctx context.Context, logger *slog.Logger, path string, ref string, comment string) error {
	if ref != "" {
		return apierrors.NewBadRequest("local repository does not support ref")
	}

	if r.path == "" {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Message: "the service is missing a root path",
				Code:    http.StatusFailedDependency,
			},
		}
	}

	return os.Remove(filepath.Join(r.path, path))
}

// Webhook implements provisioning.Repository.
func (r *localRepository) Webhook(ctx context.Context, logger *slog.Logger, responder rest.Responder) http.HandlerFunc {
	// webhooks are not supported with local
	return nil
}

func (r *localRepository) AfterCreate(ctx context.Context, logger *slog.Logger) error {
	return nil
}

func (r *localRepository) BeginUpdate(ctx context.Context, logger *slog.Logger, old Repository) (UndoFunc, error) {
	return nil, nil
}

func (r *localRepository) AfterDelete(ctx context.Context, logger *slog.Logger) error {
	return nil
}
