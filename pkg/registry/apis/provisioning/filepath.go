package provisioning

import (
	"strings"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// TODO: document in API specification
func ExtractFilePath(urlPath, prefix string) (string, error) {
	idx := strings.Index(urlPath, prefix)
	if idx == -1 {
		return "", apierrors.NewBadRequest("invalid request path")
	}

	// Extract the file path after the prefix
	filePath := strings.TrimPrefix(urlPath[idx+len(prefix):], "/")

	// Empty path is valid and represents the root
	if filePath == "" {
		return "", nil
	}

	// Validate the path for any traversal attempts first
	if err := safepath.ValidatePath(filePath); err != nil {
		return "", err
	}

	// Only check file extension if it's not a folder path
	if !safepath.IsDir(filePath) && resources.ShouldIgnorePath(filePath) {
		return "", apierrors.NewBadRequest("only yaml and json files supported")
	}

	return filePath, nil
}
