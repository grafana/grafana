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

// UnsupportedPathError reports a repository path that fails path validation.
type UnsupportedPathError struct {
	Path string
	Err  error
}

func (e *UnsupportedPathError) Error() string {
	return fmt.Sprintf("path %q is not supported: %v", e.Path, e.Err)
}

func (e *UnsupportedPathError) Unwrap() error {
	return e.Err
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

// HasResourceExtension reports whether filePath has a resource extension (yml,
// yaml, json), whatever the rest of the path looks like. IsPathSupported checks
// the path basics first, so its error alone does not tell a rejected resource
// file from a rejected non-resource file.
func HasResourceExtension(filePath string) bool {
	if safepath.IsDir(filePath) {
		return false
	}
	ext := strings.ToLower(path.Ext(filePath))
	return resourceExtensions[ext]
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
