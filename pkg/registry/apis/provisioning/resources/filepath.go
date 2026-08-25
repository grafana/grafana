package resources

import (
	"errors"
	"fmt"
	"path"
	"strings"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

var (
	ErrPathTooDeep              = errors.New("the path is too deep")
	ErrUnsupportedFileExtension = errors.New("unsupported file extension")
	ErrNotRelative              = errors.New("path must be relative to the root")
)

// UnsupportedPath pairs a repository path with the reason it failed path
// validation. Never produced for a plain extension mismatch (e.g. README.md).
type UnsupportedPath struct {
	Path string
	Err  error
}

// UnsupportedPathError aggregates every UnsupportedPath found in one sync pass.
type UnsupportedPathError struct {
	Paths []UnsupportedPath
}

func (e *UnsupportedPathError) Error() string {
	if len(e.Paths) == 1 {
		return fmt.Sprintf("path %q cannot be synced: %v", e.Paths[0].Path, e.Paths[0].Err)
	}
	var b strings.Builder
	fmt.Fprintf(&b, "%d paths cannot be synced:", len(e.Paths))
	for _, p := range e.Paths {
		fmt.Fprintf(&b, "\n  %q: %v", p.Path, p.Err)
	}
	return b.String()
}

func (e *UnsupportedPathError) Unwrap() []error {
	errs := make([]error, len(e.Paths))
	for i, p := range e.Paths {
		errs[i] = p.Err
	}
	return errs
}

const maxPathDepth = 8

// resourceExtensions are file extensions that contain k8s resources and can be parsed.
var resourceExtensions = map[string]bool{
	".yml":  true,
	".yaml": true,
	".json": true,
}

// readOnlyExtensions are file extensions that can be read as raw content (read-only).
var readOnlyExtensions = map[string]bool{
	".md": true,
}

// IsPathSupported checks if the file path is supported by the provisioning API for write operations.
// It validates the path is safe and that the file extension is one of the resource types
// (yml, yaml, json).
func IsPathSupported(filePath string) error {
	if err := validatePathBasics(filePath); err != nil {
		return err
	}

	if !safepath.IsDir(filePath) {
		ext := strings.ToLower(path.Ext(filePath))
		if !resourceExtensions[ext] {
			return ErrUnsupportedFileExtension
		}
	}

	return nil
}

// IsReadablePath checks if the file path is supported for read operations. This includes resource
// files (yml, yaml, json) and read-only files (md).
func IsReadablePath(filePath string) error {
	if err := validatePathBasics(filePath); err != nil {
		return err
	}

	if !safepath.IsDir(filePath) {
		ext := strings.ToLower(path.Ext(filePath))
		if !resourceExtensions[ext] && !readOnlyExtensions[ext] {
			return ErrUnsupportedFileExtension
		}
	}

	return nil
}

// IsRawFile reports whether the file path points at a read-only raw file (not a k8s resource).
func IsRawFile(filePath string) bool {
	if safepath.IsDir(filePath) {
		return false
	}
	ext := strings.ToLower(path.Ext(filePath))
	return readOnlyExtensions[ext]
}

func validatePathBasics(filePath string) error {
	if err := safepath.IsSafe(filePath); err != nil {
		return err
	}

	if safepath.Depth(filePath) > maxPathDepth {
		return ErrPathTooDeep
	}

	if safepath.IsAbs(filePath) {
		return ErrNotRelative
	}

	return nil
}
