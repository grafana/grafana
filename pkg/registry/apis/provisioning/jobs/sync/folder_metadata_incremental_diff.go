package sync

import (
	"context"
	"errors"
	"fmt"

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

// NewFolderMetadataIncrementalDiffBuilder wires the repository reader and
// managed-resource lister used to rewrite `_folder.json` changes into the
// directory/resource diff entries consumed by incremental apply.
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
	input := splitMetadataChanges(repoDiff)
	if !input.HasMetadataChanges() {
		return repoDiff, nil, nil
	}

	target, err := d.repositoryResources.List(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("list managed resources: %w", err)
	}

	index := newManagedResourceIndex(target)
	diffTracker := newRebuiltIncrementalDiffTracker(input.otherChanges)

	for _, change := range input.MetadataChanges() {
		if err := d.rewriteMetadataChange(ctx, currentRef, input, index, diffTracker, change); err != nil {
			return nil, nil, err
		}
	}

	return diffTracker.IncrementalDiff(), diffTracker.ReplacedFolders(), nil
}

// rewriteMetadataChange dispatches each handled metadata action to the
// specialized rewrite flow for create/update or delete semantics.
func (d *folderMetadataIncrementalDiffBuilder) rewriteMetadataChange(
	ctx context.Context,
	currentRef string,
	input folderMetadataDiffSplit,
	index managedResourceIndex,
	diffTracker *rebuiltIncrementalDiffTracker,
	change repository.VersionedFileChange,
) error {
	switch change.Action {
	case repository.FileActionCreated, repository.FileActionUpdated:
		return d.rewriteCreatedOrUpdatedMetadataChange(ctx, input, index, diffTracker, change)
	case repository.FileActionDeleted:
		return d.rewriteDeletedMetadataChange(ctx, currentRef, input, index, diffTracker, change)
	default:
		return nil
	}
}

// rewriteCreatedOrUpdatedMetadataChange turns a metadata create or update into
// a synthetic folder update plus any direct-child updates needed to replay the
// new folder identity through the standard incremental apply path.
func (d *folderMetadataIncrementalDiffBuilder) rewriteCreatedOrUpdatedMetadataChange(
	ctx context.Context,
	input folderMetadataDiffSplit,
	index managedResourceIndex,
	diffTracker *rebuiltIncrementalDiffTracker,
	change repository.VersionedFileChange,
) error {
	folderPath := folderPathForMetadataChange(change.Path)

	// In case the folder path is not in the original diff, and we didn't generate a change yet,
	// we append an update change for it.
	if !input.HadChangeOriginallyAt(folderPath) && !diffTracker.HasGeneratedPath(folderPath) {
		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   folderPath,
			Ref:    change.Ref,
		})
	}

	replaced, err := d.replacementForMetadataChange(ctx, index, folderPath, change)
	if err != nil {
		return err
	}
	if replaced != nil {
		diffTracker.AppendReplaced(*replaced)
	}

	for _, childPath := range index.DirectChildrenOf(folderPath) {
		// Skip children that already have a real diff entry, are going to be
		// handled by their own metadata rewrite (e.g. folders with metadata changes),
		// or were already emitted while expanding a deeper metadata change.
		// That keeps the rewritten diff stable and avoids replaying the same child more than once.
		if input.HadChangeOriginallyAt(childPath) || input.HasMetadataFolderAt(childPath) || diffTracker.HasGeneratedPath(childPath) {
			continue
		}

		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   childPath,
			Ref:    change.Ref,
		})
	}

	return nil
}

// rewriteDeletedMetadataChange handles `_folder.json` deletion by either
// reverting the folder to its path-derived identity when the directory still
// exists, or by scheduling direct cleanup when the whole folder is gone.
func (d *folderMetadataIncrementalDiffBuilder) rewriteDeletedMetadataChange(
	ctx context.Context,
	currentRef string,
	input folderMetadataDiffSplit,
	index managedResourceIndex,
	diffTracker *rebuiltIncrementalDiffTracker,
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
		diffTracker.AppendReplaced(*replacement)
	}

	if !directoryExists {
		return nil
	}

	if !input.HadChangeOriginallyAt(folderPath) && !diffTracker.HasGeneratedPath(folderPath) {
		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   folderPath,
			Ref:    currentRef,
		})
	}

	if replacement == nil {
		return nil
	}

	for _, childPath := range index.DirectChildrenOf(folderPath) {
		// Skip children that already have a real diff entry, are going to be
		// handled by their own metadata rewrite (e.g. folders with metadata changes),
		// or were already emitted while expanding a deeper metadata change.
		// That keeps the rewritten diff stable and avoids replaying the same child more than once.
		if input.HadChangeOriginallyAt(childPath) || input.HasMetadataFolderAt(childPath) || diffTracker.HasGeneratedPath(childPath) {
			continue
		}

		diffTracker.Append(repository.VersionedFileChange{
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
// cleaned up directly without emitting any other changes.
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

// folderPathForMetadataChange converts a `_folder.json` file path into the
// normalized folder path used by managed-resource lookups and synthetic diff
// entries.
func folderPathForMetadataChange(metadataPath string) string {
	return safepath.EnsureTrailingSlash(safepath.Dir(metadataPath))
}
