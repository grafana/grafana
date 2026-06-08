package resources

import (
	"errors"
	"path"
	"strings"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

var (
	ErrPathTooDeep              = errors.New("the path is too deep")
	ErrUnsupportedFileExtension = errors.New("unsupported file extension")
	ErrNotRelative              = errors.New("path must be relative to the root")
)

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
