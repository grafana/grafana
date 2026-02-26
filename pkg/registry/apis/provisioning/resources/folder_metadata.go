package resources

import (
	"encoding/json"
	"fmt"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
)

const FolderMetadataFileName = "_folder.json"

// NewFolderManifest builds a Folder resource ready for serialization into _folder.json.
// uid is the stable K8s name; title is the human-readable folder name.
func NewFolderManifest(uid, title string) *folders.Folder {
	f := folders.NewFolder()
	f.SetGroupVersionKind(folders.FolderResourceInfo.GroupVersionKind())
	f.Name = uid
	f.Spec.Title = title
	return f
}

// FolderManifestUID parses a _folder.json byte slice and returns the stable UID
// stored in metadata.name.
func FolderManifestUID(data []byte) (string, error) {
	var f folders.Folder
	if err := json.Unmarshal(data, &f); err != nil {
		return "", fmt.Errorf("parse folder manifest: %w", err)
	}
	return f.Name, nil
}
