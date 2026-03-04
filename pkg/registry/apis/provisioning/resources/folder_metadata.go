package resources

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// IsFolderMetadataEnabled reports whether the provisioningFolderMetadata feature flag is on.
func IsFolderMetadataEnabled(cfg *setting.Cfg) bool {
	//nolint:staticcheck // The usage of this function is deprecated, but we don't plan to keep it for long.
	return cfg.IsFeatureToggleEnabled(featuremgmt.FlagProvisioningFolderMetadata)
}

const folderMetadataFileName = "_folder.json"

// IsFolderMetadataFile reports whether path refers to a _folder.json file.
func IsFolderMetadataFile(path string) bool {
	return filepath.Base(path) == folderMetadataFileName
}

// NewFolderManifest builds a Folder resource ready for serialization into _folder.json.
// uid is the stable K8s name; title is the human-readable folder name.
func NewFolderManifest(uid, title string) *folders.Folder {
	f := folders.NewFolder()
	f.SetGroupVersionKind(folders.FolderResourceInfo.GroupVersionKind())
	f.Name = uid
	f.Spec.Title = title
	return f
}

// marshalFolderManifest serializes a Folder resource to JSON.
func marshalFolderManifest(folder *folders.Folder) ([]byte, error) {
	data, err := json.Marshal(folder)
	if err != nil {
		return nil, fmt.Errorf("marshal folder manifest: %w", err)
	}
	return data, nil
}

// ReadFolderMetadata reads _folder.json from folderPath and returns the Folder resource.
func ReadFolderMetadata(ctx context.Context, repo repository.ReaderWriter, folderPath, ref string) (*folders.Folder, error) {
	metadataPath := safepath.Join(folderPath, folderMetadataFileName)
	info, err := repo.Read(ctx, metadataPath, ref)
	if err != nil {
		return nil, err
	}
	var f folders.Folder
	if err := json.Unmarshal(info.Data, &f); err != nil {
		return nil, fmt.Errorf("parse folder manifest: %w", err)
	}
	return &f, nil
}

// WriteFolderMetadata writes _folder.json into folderPath and returns the stable UID.
func WriteFolderMetadata(ctx context.Context, repo repository.ReaderWriter, folderPath string, folder *folders.Folder, ref, message string) (string, error) {
	data, err := marshalFolderManifest(folder)
	if err != nil {
		return "", fmt.Errorf("marshal folder metadata: %w", err)
	}
	metadataPath := safepath.Join(folderPath, folderMetadataFileName)
	if err := repo.Create(ctx, metadataPath, ref, data, message); err != nil {
		return "", fmt.Errorf("failed to create folder metadata: %w", err)
	}
	return folder.Name, nil
}
