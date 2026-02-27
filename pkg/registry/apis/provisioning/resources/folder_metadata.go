package resources

import (
	"encoding/json"
	"fmt"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/util"
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

// MarshalFolderManifest generates a stable UID and marshals a _folder.json manifest
// for the given folderPath. The title is derived from the last path segment.
// Returns the uid, the JSON bytes, and any error.
func MarshalFolderManifest(folderPath string) (uid string, data []byte, err error) {
	uid = util.GenerateShortUID()
	title := safepath.Base(folderPath)
	manifest := NewFolderManifest(uid, title)
	data, err = json.Marshal(manifest)
	if err != nil {
		return "", nil, fmt.Errorf("marshal folder manifest: %w", err)
	}
	return uid, data, nil
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
