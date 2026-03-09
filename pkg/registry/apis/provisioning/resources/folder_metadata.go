package resources

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
func ReadFolderMetadata(ctx context.Context, repo repository.Reader, folderPath, ref string) (*folders.Folder, error) {
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

// GetFolderID returns the folder ID for the given path.
// When folderMetadataEnabled is true, it attempts to read the stable UID from _folder.json.
// If metadata is disabled or reading fails, it falls back to the hash-based ID.
func GetFolderID(ctx context.Context, reader repository.Reader, path, ref string, folderMetadataEnabled bool) string {
	if folderMetadataEnabled {
		if meta, err := ReadFolderMetadata(ctx, reader, path, ref); err == nil && meta.Name != "" {
			return meta.Name
		}
	}
	return ParseFolder(path, reader.Config().Name).ID
}

// ParseFolderResource constructs a ParsedResource for a folder at the given path.
// This allows folders to be authorized using the same AuthorizeResource flow as other resources.
func ParseFolderResource(ctx context.Context, reader repository.Reader, path, ref string, folderMetadataEnabled bool) (*ParsedResource, error) {
	config := reader.Config()

	// Try to read existing folder metadata (single read for both metadata and ID)
	var folderObj *folders.Folder
	var folderID string
	var err error

	if folderMetadataEnabled {
		folderObj, err = ReadFolderMetadata(ctx, reader, path, ref)
		if err != nil && err != repository.ErrFileNotFound {
			return nil, fmt.Errorf("read folder metadata: %w", err)
		}

		// If metadata was found, use its stable UID
		if folderObj != nil && folderObj.Name != "" {
			folderID = folderObj.Name
		}
	}

	// If no metadata exists or metadata is disabled, use hash-based ID
	if folderID == "" {
		folderID = ParseFolder(path, config.Name).ID
	}

	// If no metadata object exists, create a minimal folder object
	if folderObj == nil {
		folderObj = NewFolderManifest(folderID, safepath.Base(path))
	}

	// Convert to unstructured
	unstructuredMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(folderObj)
	if err != nil {
		return nil, fmt.Errorf("convert folder to unstructured: %w", err)
	}
	folderUnstructured := &unstructured.Unstructured{Object: unstructuredMap}

	// Get metadata accessor
	meta, err := utils.MetaAccessor(folderUnstructured)
	if err != nil {
		return nil, fmt.Errorf("get metadata accessor: %w", err)
	}

	// For folder resources, set the folder field to the PARENT folder's ID.
	// This matches how folder permissions work: when checking permissions on a folder,
	// we check in the context of its parent folder.
	parentPath := safepath.Dir(path)
	var parentFolderID string
	if parentPath == "" {
		// Root-level folder - parent is the root (empty string)
		parentFolderID = ""
	} else {
		// Get the parent folder's ID
		parentFolderID = GetFolderID(ctx, reader, parentPath, ref, folderMetadataEnabled)
	}
	meta.SetFolder(parentFolderID)

	return &ParsedResource{
		Info: &repository.FileInfo{
			Path: path,
			Ref:  ref,
		},
		Repo: provisioning.ResourceRepositoryInfo{
			Type:      config.Spec.Type,
			Namespace: config.Namespace,
			Name:      config.Name,
			Title:     config.Spec.Title,
		},
		Obj:    folderUnstructured,
		Meta:   meta,
		GVK:    folders.FolderResourceInfo.GroupVersionKind(),
		GVR:    FolderResource,
		Action: provisioning.ResourceActionUpdate, // Default to update for authorization
	}, nil
}
