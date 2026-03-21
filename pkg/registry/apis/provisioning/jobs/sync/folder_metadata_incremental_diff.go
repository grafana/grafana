package sync

import (
	"context"
	"errors"
	"fmt"
	"slices"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

//go:generate mockery --name FolderMetadataIncrementalDiffBuilder --structname MockFolderMetadataIncrementalDiffBuilder --inpackage --filename incremental_diff_builder_mock.go --with-expecter
type FolderMetadataIncrementalDiffBuilder interface {
	BuildIncrementalDiff(
		ctx context.Context,
		currentRef string,
		repoDiff []repository.VersionedFileChange,
	) ([]repository.VersionedFileChange, []replacedFolder, error)
}

type folderMetadataIncrementalDiffBuilder struct {
	repo                repository.Reader
	repositoryResources resources.RepositoryResources
}

type replacedFolder struct {
	Path   string
	OldUID string
}

// versionedChanges wraps a raw incremental diff with the queries needed by the
// folder-metadata rewrite logic.
type versionedChanges struct {
	passthroughChanges  []repository.VersionedFileChange
	metadataChanges     []repository.VersionedFileChange
	changedPaths        map[string]struct{}
	metadataFolderPaths map[string]struct{}
}

// managedResourceIndex is a path index over the current managed resources so
// the rebuilder can find existing folders and direct children efficiently.
type managedResourceIndex struct {
	byPath map[string]*provisioning.ResourceListItem
}

// rebuiltIncrementalDiff accumulates the rewritten diff and tracks synthetic
// paths so we do not emit duplicate synthetic changes.
type rebuiltIncrementalDiff struct {
	filteredDiff   []repository.VersionedFileChange
	syntheticPaths map[string]struct{}
	replaced       []replacedFolder
}

func NewFolderMetadataIncrementalDiffBuilder(
	repo repository.Reader,
	repositoryResources resources.RepositoryResources,
) *folderMetadataIncrementalDiffBuilder {
	return &folderMetadataIncrementalDiffBuilder{
		repo:                repo,
		repositoryResources: repositoryResources,
	}
}

// BuildIncrementalDiff rewrites handled `_folder.json` create/update/delete
// events into synthetic folder changes plus direct-child updates.
//
// The rebuilder keeps unrelated git changes intact, preserves real diff paths,
// and returns any old folder UIDs that must be deleted after the rewritten diff
// is applied.
func (d *folderMetadataIncrementalDiffBuilder) BuildIncrementalDiff(
	ctx context.Context,
	currentRef string,
	repoDiff []repository.VersionedFileChange,
) ([]repository.VersionedFileChange, []replacedFolder, error) {
	input := newVersionedChanges(repoDiff)
	if !input.HasMetadataChanges() {
		return repoDiff, nil, nil
	}

	target, err := d.repositoryResources.List(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("list managed resources: %w", err)
	}

	index := newManagedResourceIndex(target)
	result := newRebuiltIncrementalDiff(input.PassthroughChanges())

	for _, change := range input.MetadataChanges() {
		if err := d.rewriteMetadataChange(ctx, currentRef, input, index, result, change); err != nil {
			return nil, nil, err
		}
	}

	return result.filteredDiff, result.replaced, nil
}

func newVersionedChanges(repoDiff []repository.VersionedFileChange) versionedChanges {
	input := versionedChanges{
		passthroughChanges:  make([]repository.VersionedFileChange, 0, len(repoDiff)),
		metadataChanges:     make([]repository.VersionedFileChange, 0),
		changedPaths:        make(map[string]struct{}, len(repoDiff)),
		metadataFolderPaths: make(map[string]struct{}),
	}

	for _, change := range repoDiff {
		if isHandledFolderMetadataChange(change) {
			input.metadataChanges = append(input.metadataChanges, change)
			input.metadataFolderPaths[folderPathForMetadataChange(change.Path)] = struct{}{}
			continue
		}

		input.passthroughChanges = append(input.passthroughChanges, change)
		input.changedPaths[change.Path] = struct{}{}
		if change.Action == repository.FileActionRenamed {
			input.changedPaths[change.PreviousPath] = struct{}{}
		}
	}

	safepath.SortByDepth(input.metadataChanges, func(change repository.VersionedFileChange) string {
		return change.Path
	}, false)

	return input
}

func (input versionedChanges) HasMetadataChanges() bool {
	return len(input.metadataChanges) > 0
}

func (input versionedChanges) PassthroughChanges() []repository.VersionedFileChange {
	return slices.Clone(input.passthroughChanges)
}

func (input versionedChanges) MetadataChanges() []repository.VersionedFileChange {
	return slices.Clone(input.metadataChanges)
}

func (input versionedChanges) HasRealChangeAt(path string) bool {
	_, ok := input.changedPaths[path]
	return ok
}

func (input versionedChanges) HasMetadataFolderAt(path string) bool {
	_, ok := input.metadataFolderPaths[path]
	return ok
}

func newManagedResourceIndex(target *provisioning.ResourceList) managedResourceIndex {
	index := managedResourceIndex{
		byPath: make(map[string]*provisioning.ResourceListItem),
	}
	if target == nil {
		return index
	}

	for i := range target.Items {
		item := &target.Items[i]
		index.byPath[normalizeManagedResourcePath(item)] = item
	}

	return index
}

func (index managedResourceIndex) ExistingAt(path string) *provisioning.ResourceListItem {
	return index.byPath[path]
}

func (index managedResourceIndex) DirectChildrenOf(parentPath string) []string {
	childrenPaths := make([]string, 0)
	for path := range index.byPath {
		if safepath.Dir(path) == parentPath {
			childrenPaths = append(childrenPaths, path)
		}
	}
	slices.Sort(childrenPaths)
	return childrenPaths
}

func newRebuiltIncrementalDiff(passthrough []repository.VersionedFileChange) *rebuiltIncrementalDiff {
	return &rebuiltIncrementalDiff{
		filteredDiff:   passthrough,
		syntheticPaths: make(map[string]struct{}),
		replaced:       make([]replacedFolder, 0),
	}
}

func (result *rebuiltIncrementalDiff) HasSyntheticPath(path string) bool {
	_, ok := result.syntheticPaths[path]
	return ok
}

func (result *rebuiltIncrementalDiff) Append(change repository.VersionedFileChange) {
	result.filteredDiff = append(result.filteredDiff, change)
	result.syntheticPaths[change.Path] = struct{}{}
}

func (result *rebuiltIncrementalDiff) AppendReplaced(replaced replacedFolder) {
	result.replaced = append(result.replaced, replaced)
}

func (d *folderMetadataIncrementalDiffBuilder) rewriteMetadataChange(
	ctx context.Context,
	currentRef string,
	input versionedChanges,
	index managedResourceIndex,
	result *rebuiltIncrementalDiff,
	change repository.VersionedFileChange,
) error {
	switch change.Action {
	case repository.FileActionCreated, repository.FileActionUpdated:
		return d.rewriteCreatedOrUpdatedMetadataChange(ctx, input, index, result, change)
	case repository.FileActionDeleted:
		return d.rewriteDeletedMetadataChange(ctx, currentRef, input, index, result, change)
	default:
		return nil
	}
}

func (d *folderMetadataIncrementalDiffBuilder) rewriteCreatedOrUpdatedMetadataChange(
	ctx context.Context,
	input versionedChanges,
	index managedResourceIndex,
	result *rebuiltIncrementalDiff,
	change repository.VersionedFileChange,
) error {
	folderPath := folderPathForMetadataChange(change.Path)

	if !input.HasRealChangeAt(folderPath) && !result.HasSyntheticPath(folderPath) {
		result.Append(repository.VersionedFileChange{
			Action: change.Action,
			Path:   folderPath,
			Ref:    change.Ref,
		})
	}

	replaced, err := d.replacementForMetadataChange(ctx, index, folderPath, change)
	if err != nil {
		return err
	}
	if replaced != nil {
		result.AppendReplaced(*replaced)
	}

	for _, childPath := range index.DirectChildrenOf(folderPath) {
		if input.HasRealChangeAt(childPath) || input.HasMetadataFolderAt(childPath) || result.HasSyntheticPath(childPath) {
			continue
		}

		result.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   childPath,
			Ref:    change.Ref,
		})
	}

	return nil
}

func (d *folderMetadataIncrementalDiffBuilder) rewriteDeletedMetadataChange(
	ctx context.Context,
	currentRef string,
	input versionedChanges,
	index managedResourceIndex,
	result *rebuiltIncrementalDiff,
	change repository.VersionedFileChange,
) error {
	folderPath := folderPathForMetadataChange(change.Path)
	existing := index.ExistingAt(folderPath)
	if existing == nil {
		return nil
	}

	replacement, directoryExists, err := d.replacementForDeletedMetadataChange(ctx, currentRef, folderPath, existing)
	if err != nil {
		return err
	}

	if replacement != nil {
		result.AppendReplaced(*replacement)
	}

	if !directoryExists {
		return nil
	}

	if !input.HasRealChangeAt(folderPath) && !result.HasSyntheticPath(folderPath) {
		result.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   folderPath,
			Ref:    currentRef,
		})
	}

	if replacement == nil {
		return nil
	}

	for _, childPath := range index.DirectChildrenOf(folderPath) {
		if input.HasRealChangeAt(childPath) || input.HasMetadataFolderAt(childPath) || result.HasSyntheticPath(childPath) {
			continue
		}

		result.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   childPath,
			Ref:    currentRef,
		})
	}

	return nil
}

// replacementForMetadataChange determines whether a metadata change at a folder
// path actually replaces the current folder identity.
//
// A folder is only marked for later deletion when the managed folder already
// exists at that path and the UID resolved from the new `_folder.json` differs
// from the existing folder UID.
func (d *folderMetadataIncrementalDiffBuilder) replacementForMetadataChange(
	ctx context.Context,
	index managedResourceIndex,
	folderPath string,
	change repository.VersionedFileChange,
) (*replacedFolder, error) {
	existing := index.ExistingAt(folderPath)
	if existing == nil {
		return nil, nil
	}

	folder, _, err := resources.ReadFolderMetadata(ctx, d.repo, folderPath, change.Ref)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read folder metadata for %s: %w", folderPath, err)
	}
	if folder.GetName() == existing.Name {
		return nil, nil
	}

	return &replacedFolder{
		Path:   folderPath,
		OldUID: existing.Name,
	}, nil
}

// replacementForDeletedMetadataChange determines whether deleting _folder.json
// changes the current folder identity.
//
// When the directory still exists at currentRef, the folder falls back to its
// path-derived UID. When the directory is gone, the existing folder can be
// cleaned up directly without emitting synthetic replay work.
func (d *folderMetadataIncrementalDiffBuilder) replacementForDeletedMetadataChange(
	ctx context.Context,
	currentRef string,
	folderPath string,
	existing *provisioning.ResourceListItem,
) (*replacedFolder, bool, error) {
	_, err := d.repo.Read(ctx, folderPath, currentRef)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
			return &replacedFolder{
				Path:   folderPath,
				OldUID: existing.Name,
			}, false, nil
		}
		return nil, false, fmt.Errorf("read folder directory %s at ref %s: %w", folderPath, currentRef, err)
	}

	folder := resources.ParseFolder(folderPath, d.repo.Config().Name)
	if folder.ID == existing.Name {
		return nil, true, nil
	}

	return &replacedFolder{
		Path:   folderPath,
		OldUID: existing.Name,
	}, true, nil
}

func isHandledFolderMetadataChange(change repository.VersionedFileChange) bool {
	if !resources.IsFolderMetadataFile(change.Path) {
		return false
	}

	return change.Action == repository.FileActionCreated ||
		change.Action == repository.FileActionUpdated ||
		change.Action == repository.FileActionDeleted
}

func folderPathForMetadataChange(metadataPath string) string {
	return safepath.EnsureTrailingSlash(safepath.Dir(metadataPath))
}

func normalizeManagedResourcePath(item *provisioning.ResourceListItem) string {
	if item.Group == resources.FolderResource.Group {
		return safepath.EnsureTrailingSlash(item.Path)
	}
	return item.Path
}
