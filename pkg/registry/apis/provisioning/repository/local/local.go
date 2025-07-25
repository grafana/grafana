package local

import (
	"context"
	"path"

	// Git still uses sha1 for the most part: https://git-scm.com/docs/hash-function-transition
	//nolint:gosec
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type LocalFolderResolver struct {
	PermittedPrefixes []string
	HomePath          string
}

type InvalidLocalFolderError struct {
	Path           string
	AdditionalInfo string
}

var (
	_ error               = (*InvalidLocalFolderError)(nil)
	_ apierrors.APIStatus = (*InvalidLocalFolderError)(nil)
)

func (e *InvalidLocalFolderError) Error() string {
	return fmt.Sprintf("the path given ('%s') is invalid for a local repository (%s)", e.Path, e.AdditionalInfo)
}

func (e *InvalidLocalFolderError) Status() metav1.Status {
	return metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusBadRequest,
		Reason:  metav1.StatusReasonBadRequest,
		Message: e.Error(),
	}
}

func (r *LocalFolderResolver) LocalPath(p string) (string, error) {
	if len(r.PermittedPrefixes) == 0 {
		return "", &InvalidLocalFolderError{p, "no permitted prefixes were configured"}
	}

	originalPath := p
	if !path.IsAbs(p) {
		p = safepath.Join(r.HomePath, p)
	} else {
		p = safepath.Clean(p)
	}

	for _, permitted := range r.PermittedPrefixes {
		if safepath.InDir(p, permitted) {
			return p, nil
		}
	}
	return "", &InvalidLocalFolderError{originalPath, "the path matches no permitted prefix"}
}

var (
	_ repository.Repository = (*localRepository)(nil)
	_ repository.Writer     = (*localRepository)(nil)
	_ repository.Reader     = (*localRepository)(nil)
)

type localRepository struct {
	config   *provisioning.Repository
	resolver *LocalFolderResolver

	// validated path that can be read if not empty
	path string
}

func NewLocal(config *provisioning.Repository, resolver *LocalFolderResolver) *localRepository {
	r := &localRepository{
		config:   config,
		resolver: resolver,
	}
	if config.Spec.Local != nil {
		r.path, _ = resolver.LocalPath(config.Spec.Local.Path)
		if r.path != "" && !safepath.IsDir(r.path) {
			r.path += "/"
		}

		for i, permitted := range r.resolver.PermittedPrefixes {
			r.resolver.PermittedPrefixes[i] = safepath.Clean(permitted)
		}
	}

	return r
}

func (r *localRepository) Config() *provisioning.Repository {
	return r.config
}

// Validate implements provisioning.Repository.
func (r *localRepository) Validate() field.ErrorList {
	cfg := r.config.Spec.Local
	if cfg == nil {
		return field.ErrorList{&field.Error{
			Type:  field.ErrorTypeRequired,
			Field: "spec.local",
		}}
	}

	// The path value must be set for local provisioning
	if cfg.Path == "" {
		return field.ErrorList{field.Required(field.NewPath("spec", "local", "path"),
			"must enter a path to local file")}
	}

	if err := safepath.IsSafe(cfg.Path); err != nil {
		return field.ErrorList{field.Invalid(field.NewPath("spec", "local", "path"),
			cfg.Path, err.Error())}
	}

	// Check if it is valid
	_, err := r.resolver.LocalPath(cfg.Path)
	if err != nil {
		return field.ErrorList{field.Invalid(field.NewPath("spec", "local", "path"),
			cfg.Path, err.Error())}
	}

	return nil
}

// Test implements provisioning.Repository.
// NOTE: Validate has been called (and passed) before this function should be called
func (r *localRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	path := field.NewPath("spec", "local", "path")
	if r.config.Spec.Local.Path == "" {
		return repository.FromFieldError(field.Required(path, "no path is configured")), nil
	}

	_, err := r.resolver.LocalPath(r.config.Spec.Local.Path)
	if err != nil {
		return repository.FromFieldError(field.Invalid(path, r.config.Spec.Local.Path, err.Error())), nil
	}

	_, err = os.Stat(r.path)
	if errors.Is(err, os.ErrNotExist) {
		return repository.FromFieldError(field.NotFound(path, r.config.Spec.Local.Path)), nil
	}

	return &provisioning.TestResults{
		Code:    http.StatusOK,
		Success: true,
	}, nil
}

// Test implements provisioning.Repository.
func (r *localRepository) validateRequest(ref string) error {
	if ref != "" {
		return apierrors.NewBadRequest("local repository does not support ref")
	}

	return nil
}

// ReadResource implements provisioning.Repository.
func (r *localRepository) Read(ctx context.Context, filePath string, ref string) (*repository.FileInfo, error) {
	if err := r.validateRequest(ref); err != nil {
		return nil, err
	}

	actualPath := safepath.Join(r.path, filePath)
	info, err := os.Stat(actualPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, repository.ErrFileNotFound
	} else if err != nil {
		return nil, fmt.Errorf("stat file: %w", err)
	}

	if info.IsDir() {
		return &repository.FileInfo{
			Path: filePath,
			Modified: &metav1.Time{
				Time: info.ModTime(),
			},
		}, nil
	}

	//nolint:gosec
	data, err := os.ReadFile(actualPath)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	hash, _, err := r.calculateFileHash(actualPath)
	if err != nil {
		return nil, fmt.Errorf("calculate hash of file: %w", err)
	}

	return &repository.FileInfo{
		Path: filePath,
		Data: data,
		Hash: hash,
		Modified: &metav1.Time{
			Time: info.ModTime(),
		},
	}, nil
}

// ReadResource implements provisioning.Repository.
func (r *localRepository) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	if err := r.validateRequest(ref); err != nil {
		return nil, err
	}

	// Return an empty list when folder does not exist
	_, err := os.Stat(r.path)
	if errors.Is(err, fs.ErrNotExist) {
		return []repository.FileTreeEntry{}, nil
	}

	rootlen := len(r.path)
	entries := make([]repository.FileTreeEntry, 0, 100)
	err = filepath.Walk(r.path, func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		entry := repository.FileTreeEntry{
			Path: strings.TrimLeft(path[rootlen:], "/"),
			Size: info.Size(),
		}
		if entry.Path == "" {
			return nil // skip the root file
		}

		if !info.IsDir() {
			entry.Blob = true
			entry.Hash, _, err = r.calculateFileHash(path)
			if err != nil {
				return fmt.Errorf("read and calculate hash of path %s: %w", path, err)
			}
		} else if !strings.HasSuffix(entry.Path, "/") {
			// ensure trailing slash for directories
			entry.Path = entry.Path + "/"
		}
		entries = append(entries, entry)
		return err
	})

	return entries, err
}

func (r *localRepository) calculateFileHash(path string) (string, int64, error) {
	// Treats https://securego.io/docs/rules/g304.html
	if !safepath.InDir(path, r.path) {
		return "", 0, repository.ErrFileNotFound
	}

	// We've already made sure the path is safe, so we'll ignore the gosec lint.
	//nolint:gosec
	file, err := os.OpenFile(path, os.O_RDONLY, 0)
	if err != nil {
		return "", 0, fmt.Errorf("open file: %w", err)
	}

	// TODO: Define what hashing algorithm we want to use for the entire repository. Maybe a config option?
	hasher := sha1.New()
	// TODO: context-aware io.Copy? Is that even possible with a reasonable impl?
	size, err := io.Copy(hasher, file)
	if err != nil {
		return "", 0, fmt.Errorf("copy file: %w", err)
	}
	// NOTE: EncodeToString (& hex.Encode for that matter) return lower-case hex.
	return hex.EncodeToString(hasher.Sum(nil)), size, nil
}

func (r *localRepository) Create(ctx context.Context, filepath string, ref string, data []byte, comment string) error {
	if err := r.validateRequest(ref); err != nil {
		return err
	}

	fpath := safepath.Join(r.path, filepath)
	_, err := os.Stat(fpath)
	if !errors.Is(err, os.ErrNotExist) {
		if err != nil {
			return apierrors.NewInternalError(fmt.Errorf("failed to check if file exists: %w", err))
		}
		return apierrors.NewAlreadyExists(schema.GroupResource{}, filepath)
	}

	if safepath.IsDir(fpath) {
		if data != nil {
			return apierrors.NewBadRequest("data cannot be provided for a directory")
		}

		if err := os.MkdirAll(fpath, 0700); err != nil {
			return apierrors.NewInternalError(fmt.Errorf("failed to create path: %w", err))
		}

		return nil
	}

	if err := os.MkdirAll(path.Dir(fpath), 0700); err != nil {
		return apierrors.NewInternalError(fmt.Errorf("failed to create path: %w", err))
	}

	return os.WriteFile(fpath, data, 0600)
}

func (r *localRepository) Update(ctx context.Context, path string, ref string, data []byte, comment string) error {
	if err := r.validateRequest(ref); err != nil {
		return err
	}

	path = safepath.Join(r.path, path)
	if safepath.IsDir(path) {
		return apierrors.NewBadRequest("cannot update a directory")
	}

	f, err := os.Stat(path)
	if err != nil && errors.Is(err, os.ErrNotExist) {
		return repository.ErrFileNotFound
	}
	if f.IsDir() {
		return apierrors.NewBadRequest("path exists but it is a directory")
	}

	return os.WriteFile(path, data, 0600)
}

func (r *localRepository) Write(ctx context.Context, fpath, ref string, data []byte, comment string) error {
	if err := r.validateRequest(ref); err != nil {
		return err
	}

	fpath = safepath.Join(r.path, fpath)
	if safepath.IsDir(fpath) {
		return os.MkdirAll(fpath, 0700)
	}

	if err := os.MkdirAll(path.Dir(fpath), 0700); err != nil {
		return apierrors.NewInternalError(fmt.Errorf("failed to create path: %w", err))
	}

	return os.WriteFile(fpath, data, 0600)
}

func (r *localRepository) Delete(ctx context.Context, path string, ref string, comment string) error {
	if err := r.validateRequest(ref); err != nil {
		return err
	}

	fullPath := safepath.Join(r.path, path)

	if safepath.IsDir(path) {
		// if it is a folder, delete all of its contents
		return os.RemoveAll(fullPath)
	}

	return os.Remove(fullPath)
}

func (r *localRepository) Move(ctx context.Context, oldPath, newPath, ref, comment string) error {
	if err := r.validateRequest(ref); err != nil {
		return err
	}

	oldFullPath := safepath.Join(r.path, oldPath)
	newFullPath := safepath.Join(r.path, newPath)

	// Check if source exists
	sourceInfo, err := os.Stat(oldFullPath)
	if errors.Is(err, os.ErrNotExist) {
		return repository.ErrFileNotFound
	} else if err != nil {
		return fmt.Errorf("check source: %w", err)
	}

	// Check if destination already exists
	if _, err := os.Stat(newFullPath); !errors.Is(err, os.ErrNotExist) {
		if err != nil {
			return fmt.Errorf("check destination: %w", err)
		}
		return repository.ErrFileAlreadyExists
	}

	// Validate move types
	sourceIsDir := sourceInfo.IsDir()
	targetIsDir := safepath.IsDir(newPath)

	if sourceIsDir != targetIsDir {
		return apierrors.NewBadRequest("cannot move between file and directory types")
	}

	// Create destination directory if needed
	if !sourceIsDir {
		// For file moves, create the directory containing the file
		destParent := path.Dir(newFullPath)
		if err := os.MkdirAll(destParent, 0700); err != nil {
			return fmt.Errorf("create destination directory: %w", err)
		}
	} else {
		// For directory moves, create the parent directory of the destination
		// but not the destination directory itself (os.Rename will create it)
		// We need to be careful with trailing slashes in directory paths
		cleanNewPath := strings.TrimSuffix(newFullPath, "/")
		destParent := path.Dir(cleanNewPath)
		if destParent != "." && destParent != "/" && destParent != r.path {
			if err := os.MkdirAll(destParent, 0700); err != nil {
				return fmt.Errorf("create destination parent directory: %w", err)
			}
		}
	}

	// Move the file or directory
	if err := os.Rename(oldFullPath, newFullPath); err != nil {
		return fmt.Errorf("move: %w", err)
	}

	return nil
}
