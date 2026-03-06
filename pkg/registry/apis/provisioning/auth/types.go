package auth

import (
	"fmt"
	"path"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ParsedResource represents a resource parsed from a file.
// This is a minimal type to avoid importing the resources package.
type ParsedResource struct {
	Obj      *unstructured.Unstructured
	Meta     utils.GrafanaMetaAccessor
	GVR      schema.GroupVersionResource
	Existing *unstructured.Unstructured
}

// FolderResource is the GroupVersionResource for folders.
var FolderResource = schema.GroupVersionResource{
	Group:    "folder.grafana.app",
	Resource: "folders",
	Version:  "v0alpha1",
}

// parseFolder parses a folder path into a folder ID.
// This is a copy of resources.ParseFolder to avoid import cycle.
func parseFolder(dirPath, repositoryName string) string {
	dirPath = strings.TrimSuffix(dirPath, "/")
	dirPath = strings.TrimPrefix(dirPath, "/")

	if dirPath == "" {
		return fmt.Sprintf("provisioning-%s", repositoryName)
	}

	dirPath = path.Clean(dirPath)
	folderID := fmt.Sprintf("provisioning-%s-%s", repositoryName, strings.ReplaceAll(dirPath, "/", "-"))

	return folderID
}

// rootFolder returns the root folder ID for a repository.
// This is a copy of resources.RootFolder to avoid import cycle.
func rootFolder(repo *provisioning.Repository) string {
	return fmt.Sprintf("provisioning-%s", repo.Name)
}

// dirPath returns the parent directory of a path.
func dirPath(p string) string {
	dir := path.Dir(p)
	if dir == "." {
		return ""
	}
	return dir
}
