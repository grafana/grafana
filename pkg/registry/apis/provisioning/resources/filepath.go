package resources

import (
	"errors"
	"path"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

var (
	ErrPathTooDeep              = errors.New("the path is too deep")
	ErrUnsupportedFileExtension = errors.New("unsupported file extension")
)

const maxPathDepth = 8

// IsPathSupported checks if the file path is supported by the provisioning API.
// it also validates if the path is safe and if the file extension is supported.
func IsPathSupported(filePath string) error {
	// Validate the path for any traversal attempts first
	if err := safepath.IsSafe(filePath); err != nil {
		return err
	}

	if safepath.Depth(filePath) > maxPathDepth {
		return ErrPathTooDeep
	}

	// Only check file extension if it's not a folder path
	if !safepath.IsDir(filePath) {
		if ext := path.Ext(filePath); ext != ".yml" && ext != ".yaml" && ext != ".json" {
			return ErrUnsupportedFileExtension
		}
	}

	return nil
}
