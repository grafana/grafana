package resources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	folderMetadataFileName = "_folder.json"
)

// ErrMissingFolderMetadata is a sentinel error for missing _folder.json files.
var ErrMissingFolderMetadata = errors.New("missing folder metadata")

// MissingFolderMetadata is returned when a folder in the repository does not
// have a _folder.json file and thus has an unstable hash-derived UID.
type MissingFolderMetadata struct {
	Path string
}

func (e *MissingFolderMetadata) Error() string {
	return fmt.Sprintf("folder %q is missing folder metadata file - folder UID will be auto-generated and may change on next sync.", e.Path)
}

// Unwrap supports errors.Is(err, ErrMissingFolderMetadata).
func (e *MissingFolderMetadata) Unwrap() error {
	return ErrMissingFolderMetadata
}

// NewMissingFolderMetadata creates a MissingFolderMetadata error for the given folder path.
func NewMissingFolderMetadata(path string) *MissingFolderMetadata {
	return &MissingFolderMetadata{Path: path}
}

// ErrInvalidFolderMetadata is a sentinel error for malformed or incomplete _folder.json files.
var ErrInvalidFolderMetadata = errors.New("invalid folder metadata")

// InvalidFolderMetadata is returned when a folder metadata file exists but
// cannot be used to resolve folder identity.
type InvalidFolderMetadata struct {
	Path   string
	Action repository.FileAction
	Err    error
}

func (e *InvalidFolderMetadata) Error() string {
	if e.Err == nil {
		return fmt.Sprintf("invalid folder metadata at %q", e.Path)
	}
	return fmt.Sprintf("invalid folder metadata at %q: %v", e.Path, e.Err)
}

// Unwrap supports errors.Is(err, ErrInvalidFolderMetadata) while preserving the
// underlying validation/parsing failure.
func (e *InvalidFolderMetadata) Unwrap() []error {
	if e.Err == nil {
		return []error{ErrInvalidFolderMetadata}
	}
	return []error{ErrInvalidFolderMetadata, e.Err}
}

// NewInvalidFolderMetadata creates an InvalidFolderMetadata error for the given path.
func NewInvalidFolderMetadata(path string, err error) *InvalidFolderMetadata {
	return &InvalidFolderMetadata{Path: path, Err: err}
}

// WithAction records the intended file action for this invalid metadata warning.
func (e *InvalidFolderMetadata) WithAction(action repository.FileAction) *InvalidFolderMetadata {
	e.Action = action
	return e
}

// ErrFolderMetadataConflict is a sentinel error for folder metadata conflicts.
var ErrFolderMetadataConflict = errors.New("folder metadata conflict")

// FolderMetadataConflict is returned when the folder metadata in the repository
// conflicts with the folder state in Grafana (e.g., ID mismatch, user deleted
// or changed the folder ID).
type FolderMetadataConflict struct {
	Path   string
	Reason string
}

func (e *FolderMetadataConflict) Error() string {
	return fmt.Sprintf("folder metadata conflict at %q: %s", e.Path, e.Reason)
}

// Unwrap supports errors.Is(err, ErrFolderMetadataConflict).
func (e *FolderMetadataConflict) Unwrap() error {
	return ErrFolderMetadataConflict
}

// FindFoldersMissingMetadata returns folder paths from source that do not have
// a corresponding _folder.json metadata file.
func FindFoldersMissingMetadata(source []repository.FileTreeEntry) []string {
	seenFolders := make([]string, 0)
	foldersWithMeta := make(map[string]struct{})

	for _, file := range source {
		path := file.Path
		if !file.Blob {
			if !strings.HasSuffix(path, "/") {
				path += "/"
			}
			seenFolders = append(seenFolders, path)
		} else if IsFolderMetadataFile(path) {
			parent := safepath.Dir(path)
			if parent != "" {
				foldersWithMeta[parent] = struct{}{}
			}
		}
	}

	var missing []string
	for _, f := range seenFolders {
		if _, ok := foldersWithMeta[f]; !ok {
			missing = append(missing, f)
		}
	}
	return missing
}

// IsFolderMetadataEnabled reports whether the provisioningFolderMetadata feature flag is on.
func IsFolderMetadataEnabled(cfg *setting.Cfg) bool {
	//nolint:staticcheck // The usage of this function is deprecated, but we don't plan to keep it for long.
	return cfg.IsFeatureToggleEnabled(featuremgmt.FlagProvisioningFolderMetadata)
}

// IsFolderMetadataFile reports whether path refers to a _folder.json file.
func IsFolderMetadataFile(path string) bool {
	return filepath.Base(path) == folderMetadataFileName
}

// NewFolderManifest builds a Folder resource ready for serialization into _folder.json.
// uid is the stable K8s name; title is the human-readable folder name.
// gvk determines the apiVersion stamped on the manifest.
func NewFolderManifest(uid, title string, gvk schema.GroupVersionKind) *folders.Folder {
	f := folders.NewFolder()
	// TODO: This is safe because v1 and v1beta1 are aliases of each other, we should update this to use the right version type.
	f.SetGroupVersionKind(gvk)
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

// ReadFolderMetadata reads _folder.json from folderPath and returns the Folder resource and its file hash.
func ReadFolderMetadata(ctx context.Context, repo repository.Reader, folderPath, ref string) (*folders.Folder, string, error) {
	metadataPath := safepath.Join(folderPath, folderMetadataFileName)
	info, err := repo.Read(ctx, metadataPath, ref)
	if err != nil {
		return nil, "", err
	}
	var f folders.Folder
	if err := json.Unmarshal(info.Data, &f); err != nil {
		return nil, "", NewInvalidFolderMetadata(folderPath, fmt.Errorf("parse folder manifest: %w", err))
	}
	if f.Name == "" {
		return nil, "", NewInvalidFolderMetadata(folderPath, errors.New("missing metadata.name"))
	}
	return &f, info.Hash, nil
}

// WriteFolderMetadata creates _folder.json into folderPath and returns the stable UID.
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

// WriteFolderMetadataUpdate reads the existing _folder.json at folderPath, validates that the
// ID (metadata.name) has not changed, updates the mutable fields (title, description) from
// the submitted folder resource, and writes the result back. Returns the updated hash.
func WriteFolderMetadataUpdate(ctx context.Context, repo repository.ReaderWriter, folderPath, ref, message string, submitted *folders.Folder) (string, error) {
	existing, _, err := ReadFolderMetadata(ctx, repo, folderPath, ref)
	if err != nil {
		// When the target branch doesn't exist yet, fall back to reading from
		// the configured branch. ensureBranchExists (called by repo.Update)
		// creates the new branch from the configured branch, so the content is
		// identical at creation time.
		if errors.Is(err, repository.ErrRefNotFound) {
			existing, _, err = ReadFolderMetadata(ctx, repo, folderPath, "")
		}
		if err != nil {
			return "", fmt.Errorf("read existing folder metadata: %w", err)
		}
	}

	if submitted.Name != "" && submitted.Name != existing.Name {
		return "", apierrors.NewBadRequest(
			fmt.Sprintf("folder ID change is not allowed (current: %q, submitted: %q)", existing.Name, submitted.Name),
		)
	}

	if submitted.Spec.Title == "" {
		return "", apierrors.NewBadRequest("folder title must not be empty")
	}

	existing.Spec.Title = submitted.Spec.Title
	if submitted.Spec.Description != nil {
		existing.Spec.Description = submitted.Spec.Description
	}

	data, err := marshalFolderManifest(existing)
	if err != nil {
		return "", fmt.Errorf("marshal updated folder metadata: %w", err)
	}
	metadataPath := safepath.Join(folderPath, folderMetadataFileName)
	if err := repo.Update(ctx, metadataPath, ref, data, message); err != nil {
		return "", fmt.Errorf("write updated folder metadata: %w", err)
	}

	// Re-read to get the new hash
	info, err := repo.Read(ctx, metadataPath, ref)
	if err != nil {
		return "", fmt.Errorf("re-read updated folder metadata: %w", err)
	}
	return info.Hash, nil
}

// GetFolderID returns the folder ID for the given path.
// When folderMetadataEnabled is true, it attempts to read the stable UID from _folder.json.
// If metadata file doesn't exist or metadata is disabled, it falls back to the hash-based ID.
// Returns an error if reading the metadata file fails for reasons other than not existing.
func GetFolderID(ctx context.Context, reader repository.Reader, path, ref string, folderMetadataEnabled bool) (string, error) {
	folder, err := ParseFolderWithMetadata(ctx, reader, path, ref, folderMetadataEnabled)
	if err != nil {
		return "", err
	}
	return folder.ID, nil
}

// ParseFolderWithMetadata parses a Folder at the given path and applies stable UID, title, and checksum from folder metadata if it exists.
// In case folderMetadataEnabled is false, it returns the parsed folder without applying metadata.
func ParseFolderWithMetadata(ctx context.Context, reader repository.Reader, path, ref string, folderMetadataEnabled bool) (Folder, error) {
	f := ParseFolder(path, reader.Config().Name)
	if !folderMetadataEnabled {
		return f, nil
	}

	meta, hash, err := ReadFolderMetadata(ctx, reader, path, ref)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
			return f, nil
		}
		return Folder{}, fmt.Errorf("read folder metadata for %s: %w", f.Path, err)
	}

	if meta.Name != "" {
		f.ID = meta.Name
	}
	if meta.Spec.Title != "" {
		f.Title = meta.Spec.Title
	}
	f.MetadataHash = hash
	return f, nil
}

// ParseFolderResource constructs a ParsedResource for a folder at the given path.
// This allows folders to be authorized using the same AuthorizeResource flow as other resources.
// folderGVK determines the GVK/GVR set on the returned ParsedResource.
func ParseFolderResource(ctx context.Context, reader repository.Reader, path, ref string, folderMetadataEnabled bool, folderGVK schema.GroupVersionKind) (*ParsedResource, error) {
	config := reader.Config()

	// Try to read existing folder metadata (single read for both metadata and ID)
	var (
		folderObj    *folders.Folder
		folderID     string
		folderTitle  string
		err          error
		folderExists bool
	)

	if folderMetadataEnabled {
		folderObj, _, err = ReadFolderMetadata(ctx, reader, path, ref)
		if err != nil && !errors.Is(err, repository.ErrFileNotFound) {
			return nil, fmt.Errorf("read folder metadata: %w", err)
		}

		// If metadata was found, use its stable UID and title and mark folder as existing
		if folderObj != nil && folderObj.Name != "" {
			folderID = folderObj.Name
			folderTitle = folderObj.Spec.Title
			folderExists = true
		}
	}

	// If metadata wasn't found or is disabled, check if folder path exists
	// The repository interface will handle checking for folder markers (.keep, etc.)
	if !folderExists {
		_, err = reader.Read(ctx, path, ref)
		if err == nil {
			// Folder exists
			folderExists = true
		} else if !errors.Is(err, repository.ErrFileNotFound) {
			// Some other error occurred
			return nil, fmt.Errorf("check folder existence: %w", err)
		}
		// If err is ErrFileNotFound, folder doesn't exist (folderExists remains false)
	}

	// If no metadata exists or metadata is disabled, use hash-based ID
	if folderID == "" {
		folderID = ParseFolder(path, config.Name).ID
	}
	// If no metadata exists or metadata is disabled, use the path-based title
	if folderTitle == "" {
		folderTitle = safepath.Base(path)
	}

	// If no metadata object exists, create a minimal folder object
	if folderObj == nil {
		folderObj = NewFolderManifest(folderID, folderTitle, folderGVK)
	} else if folderObj.Spec.Title == "" {
		folderObj.Spec.Title = folderTitle
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
		parentFolderID, err = GetFolderID(ctx, reader, parentPath, ref, folderMetadataEnabled)
		if err != nil {
			return nil, fmt.Errorf("get parent folder ID: %w", err)
		}
	}
	meta.SetFolder(parentFolderID)

	// Determine the action based on whether the folder exists
	action := provisioning.ResourceActionUpdate
	if !folderExists {
		action = provisioning.ResourceActionCreate
	}

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
		Obj:  folderUnstructured,
		Meta: meta,
		GVK:  folderGVK,
		GVR: schema.GroupVersionResource{
			Group:    folderGVK.Group,
			Version:  folderGVK.Version,
			Resource: FolderResource.Resource,
		},
		Action: action,
	}, nil
}
