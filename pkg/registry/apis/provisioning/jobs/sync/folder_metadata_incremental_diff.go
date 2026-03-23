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

	replaced, err := d.replacementsForMetadataChange(ctx, index, folderPath, change)
	if err != nil {
		return err
	}
	for _, r := range replaced {
		diffTracker.AppendReplaced(r)
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
//
// When multiple managed folders share the same path (orphans from prior name
// changes), all of them are evaluated for replacement.
func (d *folderMetadataIncrementalDiffBuilder) rewriteDeletedMetadataChange(
	ctx context.Context,
	currentRef string,
	input folderMetadataDiffSplit,
	index managedResourceIndex,
	diffTracker *rebuiltIncrementalDiffTracker,
	change repository.VersionedFileChange,
) error {
	folderPath := folderPathForMetadataChange(change.Path)
	items := index.ExistingAt(folderPath)
	if len(items) == 0 {
		return nil
	}

	directoryExists, err := d.folderDirectoryExists(ctx, currentRef, folderPath)
	if err != nil {
		return err
	}

	hasReplacement := false
	for _, existing := range items {
		replacement := d.replacementForDeletedMetadataItem(folderPath, existing, directoryExists)
		if replacement != nil {
			diffTracker.AppendReplaced(*replacement)
			hasReplacement = true
		}
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

	if !hasReplacement {
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

// replacementsForMetadataChange determines which existing folder identities at
// a path are superseded by the new metadata.
//
// Every managed folder whose UID differs from the UID resolved from
// `_folder.json` is scheduled for deletion. When multiple orphans share the
// same path (from prior metadata.name changes) all of them are returned.
func (d *folderMetadataIncrementalDiffBuilder) replacementsForMetadataChange(
	ctx context.Context,
	index managedResourceIndex,
	folderPath string,
	change repository.VersionedFileChange,
) ([]replacedFolder, error) {
	items := index.ExistingAt(folderPath)
	if len(items) == 0 {
		return nil, nil
	}

	folder, _, err := resources.ReadFolderMetadata(ctx, d.repo, folderPath, change.Ref)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read folder metadata for %s: %w", folderPath, err)
	}

	var replaced []replacedFolder
	for _, item := range items {
		if folder.GetName() == item.Name {
			continue
		}
		replaced = append(replaced, replacedFolder{
			Path:   folderPath,
			OldUID: item.Name,
		})
	}
	return replaced, nil
}

// folderDirectoryExists checks whether the folder directory still exists in
// the repository at the given ref. The result is independent of any particular
// managed resource, so callers can invoke it once and reuse the answer across
// multiple items at the same path.
func (d *folderMetadataIncrementalDiffBuilder) folderDirectoryExists(
	ctx context.Context,
	currentRef string,
	folderPath string,
) (bool, error) {
	_, err := d.repo.Read(ctx, folderPath, currentRef)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
			return false, nil
		}
		return false, fmt.Errorf("read folder directory %s at ref %s: %w", folderPath, currentRef, err)
	}
	return true, nil
}

// replacementForDeletedMetadataItem determines whether a single managed folder
// should be scheduled for deletion after its `_folder.json` is removed.
//
// When the directory is gone, the folder is always replaced (cleanup).
// When the directory still exists, the folder falls back to its path-derived
// UID; a replacement is only emitted when the existing UID differs from that
// fallback.
func (d *folderMetadataIncrementalDiffBuilder) replacementForDeletedMetadataItem(
	folderPath string,
	existing *provisioning.ResourceListItem,
	directoryExists bool,
) *replacedFolder {
	if !directoryExists {
		return &replacedFolder{
			Path:   folderPath,
			OldUID: existing.Name,
		}
	}

	fallbackUID := resources.ParseFolder(folderPath, d.repo.Config().Name).ID
	if fallbackUID == existing.Name {
		return nil
	}

	return &replacedFolder{
		Path:   folderPath,
		OldUID: existing.Name,
	}
}

// folderPathForMetadataChange converts a `_folder.json` file path into the
// normalized folder path used by managed-resource lookups and synthetic diff
// entries.
func folderPathForMetadataChange(metadataPath string) string {
	return safepath.EnsureTrailingSlash(safepath.Dir(metadataPath))
}
