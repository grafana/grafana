package sync

import (
	"context"
	"errors"
	"fmt"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
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
		resourcesList *provisioning.ResourceList,
	) ([]repository.VersionedFileChange, map[string][]string, []replacedFolder, []*resources.InvalidFolderMetadata, error)
}

type folderMetadataIncrementalDiffBuilder struct {
	repo repository.Reader
}

type replacedFolder struct {
	Path   string
	OldUID string
	Reason string
}

// NewFolderMetadataIncrementalDiffBuilder wires the repository reader used to
// rewrite `_folder.json` changes into the directory/resource diff entries
// consumed by incremental apply.
func NewFolderMetadataIncrementalDiffBuilder(
	repo repository.Reader,
) *folderMetadataIncrementalDiffBuilder {
	return &folderMetadataIncrementalDiffBuilder{
		repo: repo,
	}
}

// BuildIncrementalDiff rewrites handled `_folder.json` create/update/delete
// events into synthetic folder changes plus direct-child updates.
//
// The rebuilder keeps unrelated git changes intact, preserves real diff paths,
// and returns:
//
//   - a rebuilt incremental diff of repository changes,
//   - a relocations map summarizing folder UID relocations,
//   - a list of folders whose UID was replaced, and
//   - any invalid folder metadata warnings.
//
// Tree cleanup based on these results is handled by callers; this method does
// not perform it directly.
func (d *folderMetadataIncrementalDiffBuilder) BuildIncrementalDiff(
	ctx context.Context,
	currentRef string,
	repoDiff []repository.VersionedFileChange,
	resourcesList *provisioning.ResourceList,
) ([]repository.VersionedFileChange, map[string][]string, []replacedFolder, []*resources.InvalidFolderMetadata, error) {
	input := splitMetadataChanges(repoDiff)
	if !input.HasMetadataChanges() {
		return repoDiff, nil, nil, nil, nil
	}

	index := newManagedResourceIndex(resourcesList)
	diffTracker := newRebuiltIncrementalDiffTracker(input.otherChanges)
	invalid := make([]*resources.InvalidFolderMetadata, 0)

	for _, change := range input.MetadataChanges() {
		warnings, err := d.rewriteMetadataChange(ctx, currentRef, input, index, diffTracker, change)
		if err != nil {
			return nil, nil, nil, nil, err
		}
		invalid = append(invalid, warnings...)
	}

	return diffTracker.IncrementalDiff(), diffTracker.Relocations(), diffTracker.ReplacedFolders(), invalid, nil
}

// rewriteMetadataChange dispatches each handled metadata action to the
// specialized rewrite flow for create/update or delete semantics.
// Renamed `_folder.json` entries are dropped from the rewritten diff because
// folder moves are driven by the directory rename entry, not by replaying the
// metadata file as a separate resource rename.
func (d *folderMetadataIncrementalDiffBuilder) rewriteMetadataChange(
	ctx context.Context,
	currentRef string,
	input folderMetadataDiffSplit,
	index managedResourceIndex,
	diffTracker *rebuiltIncrementalDiffTracker,
	change repository.VersionedFileChange,
) ([]*resources.InvalidFolderMetadata, error) {
	switch change.Action {
	case repository.FileActionCreated, repository.FileActionUpdated:
		return d.rewriteCreatedOrUpdatedMetadataChange(ctx, input, index, diffTracker, change)
	case repository.FileActionDeleted:
		return d.rewriteDeletedMetadataChange(ctx, currentRef, input, index, diffTracker, change)
	case repository.FileActionRenamed:
		return d.rewriteRenamedMetadataChange(ctx, currentRef, input, index, diffTracker, change)
	default:
		return nil, nil
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
) ([]*resources.InvalidFolderMetadata, error) {
	folderPath := folderPathForMetadataChange(change.Path)
	folder, invalidMetaErrors, err := d.readMetadata(ctx, folderPath, change.Ref, change.Action)
	if err != nil {
		return nil, err
	}

	// In case the folder path is not in the original diff, and we didn't generate a change yet,
	// we append an update change for it.
	if !input.HadChangeOriginallyAt(folderPath) && !diffTracker.HasGeneratedPath(folderPath) {
		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   folderPath,
			Ref:    change.Ref,
		})
	}

	replaced, newUID, err := d.replacementsForMetadataChange(index, folderPath, folder, change.Action)
	if err != nil {
		return nil, err
	}
	if newUID != "" && isFolderRelocating(index, input, diffTracker.activeUIDs, newUID, folderPath) {
		diffTracker.TrackRelocation(folderPath, newUID)
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

	return invalidMetaErrors, nil
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
) ([]*resources.InvalidFolderMetadata, error) {
	folderPath := folderPathForMetadataChange(change.Path)
	items := index.ExistingAt(folderPath)
	if len(items) == 0 {
		return nil, nil
	}

	directoryExists, err := d.folderDirectoryExists(ctx, currentRef, folderPath)
	if err != nil {
		return nil, err
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
		return nil, nil
	}

	if !input.HadChangeOriginallyAt(folderPath) && !diffTracker.HasGeneratedPath(folderPath) {
		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   folderPath,
			Ref:    currentRef,
		})
	}

	if !hasReplacement {
		return nil, nil
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

	return nil, nil
}

// rewriteRenamedMetadataChange handles file-only renames of _folder.json
// (e.g. old/_folder.json -> new/_folder.json) where no separate directory
// rename event exists in the diff. It treats the new path as a create/update
// and the old path as a delete so the old folder is tracked for orphan cleanup.
//
// Two special cases are handled:
//   - When PreviousPath is not a _folder.json file (e.g. foo.json renamed to
//     _folder.json), the old path is not a metadata folder so no cleanup is needed.
//   - When the new _folder.json preserves the same UID as the existing folder,
//     the folder is being moved rather than replaced, so the old UID must not
//     be scheduled for deletion (that would destroy the moved folder).
func (d *folderMetadataIncrementalDiffBuilder) rewriteRenamedMetadataChange(
	ctx context.Context,
	currentRef string,
	input folderMetadataDiffSplit,
	index managedResourceIndex,
	diffTracker *rebuiltIncrementalDiffTracker,
	change repository.VersionedFileChange,
) ([]*resources.InvalidFolderMetadata, error) {
	// Destination side: create or update the folder at the new path.
	warnings, err := d.rewriteCreatedOrUpdatedMetadataChange(ctx, input, index, diffTracker, change)
	if err != nil {
		return nil, err
	}

	// Source side: clean up the old path. If the rename originates from a
	// non-metadata file (e.g. config.json -> _folder.json), there is no
	// metadata folder to clean up.
	if !resources.IsFolderMetadataFile(change.PreviousPath) {
		return warnings, nil
	}

	// A directory-level rename in the original diff already handles this
	// folder via RenameFolderPath; skip to avoid duplicate processing.
	oldFolderPath := folderPathForMetadataChange(change.PreviousPath)
	if input.HadChangeOriginallyAt(oldFolderPath) {
		return warnings, nil
	}

	// No managed folders at the old path — nothing to clean up.
	items := index.ExistingAt(oldFolderPath)
	if len(items) == 0 {
		return warnings, nil
	}

	directoryExists, err := d.folderDirectoryExists(ctx, currentRef, oldFolderPath)
	if err != nil {
		return nil, err
	}

	// Schedule each old-path item for potential deletion.
	// ReplacedFolders() filters out UIDs that are still actively in use at
	// the destination path (tracked via TrackActiveUID in
	// rewriteCreatedOrUpdatedMetadataChange), so identity-preserving moves
	// are safely excluded without a redundant read.
	hasReplacement := false
	for _, existing := range items {
		replacement := d.replacementForDeletedMetadataItem(oldFolderPath, existing, directoryExists)
		if replacement != nil {
			diffTracker.AppendReplaced(*replacement)
			hasReplacement = true
		}
	}

	// Old directory is gone — no folder or child entries to re-sync.
	if !directoryExists {
		return warnings, nil
	}

	// Emit an update for the old folder path so it reverts to its
	// path-derived identity now that _folder.json is gone.
	if !diffTracker.HasGeneratedPath(oldFolderPath) {
		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   oldFolderPath,
			Ref:    currentRef,
		})
	}

	if !hasReplacement {
		return warnings, nil
	}

	// Re-parent direct children so they are re-synced under the
	// old folder's new (path-derived) identity. Skip children already
	// covered by the original diff, their own metadata rewrite, or a
	// prior expansion to keep the output stable and deduplicated.
	for _, childPath := range index.DirectChildrenOf(oldFolderPath) {
		if input.HadChangeOriginallyAt(childPath) || input.HasMetadataFolderAt(childPath) || diffTracker.HasGeneratedPath(childPath) {
			continue
		}

		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   childPath,
			Ref:    currentRef,
		})
	}

	return warnings, nil
}

// readMetadata reads `_folder.json` once and returns either the parsed folder
// metadata or an action-aware invalid metadata warning.
//
// Invalid or missing metadata intentionally returns a nil folder with no hard
// error. Callers still replay the folder path so apply can fall back to the
// existing folder at that path or to the path-derived unstable UID, but they do
// not treat that case as a confirmed identity replacement because there is no
// trustworthy metadata-defined UID to compare against.
func (d *folderMetadataIncrementalDiffBuilder) readMetadata(
	ctx context.Context,
	folderPath string,
	ref string,
	action repository.FileAction,
) (*folders.Folder, []*resources.InvalidFolderMetadata, error) {
	folder, _, err := resources.ReadFolderMetadata(ctx, d.repo, folderPath, ref)
	if err == nil {
		return folder, nil, nil
	}
	if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
		return nil, nil, nil
	}

	var invalidErr *resources.InvalidFolderMetadata
	if errors.As(err, &invalidErr) {
		return nil, []*resources.InvalidFolderMetadata{invalidErr.WithAction(action)}, nil
	}

	return nil, nil, fmt.Errorf("read folder metadata for %s: %w", folderPath, err)
}

// reasonForMetadataAction maps a file action on a _folder.json entry to the
// replacement reason recorded on the deleted old folder.
func reasonForMetadataAction(action repository.FileAction) string {
	switch action {
	case repository.FileActionCreated, repository.FileActionRenamed:
		return provisioning.ReasonFolderMetadataCreated
	case repository.FileActionUpdated:
		return provisioning.ReasonFolderMetadataUpdated
	default:
		return provisioning.ReasonFolderMetadataUpdated
	}
}

// replacementsForMetadataChange determines which existing folder identities at
// a path are superseded by the new metadata.
//
// Every managed folder whose UID differs from the UID resolved from
// `_folder.json` is scheduled for deletion. When multiple orphans share the
// same path (from prior metadata.name changes) all of them are returned.
// The new UID is also returned so callers can track it as active.
func (d *folderMetadataIncrementalDiffBuilder) replacementsForMetadataChange(
	index managedResourceIndex,
	folderPath string,
	folder *folders.Folder,
	action repository.FileAction,
) ([]replacedFolder, string, error) {
	// Replacements are only scheduled for confirmed identity transitions. If the
	// managed folder does not exist yet, or metadata could not be parsed into a
	// trustworthy folder identity, replay still happens but there is no old UID
	// to delete after apply.
	if folder == nil {
		return nil, "", nil
	}

	newUID := folder.GetName()

	items := index.ExistingAt(folderPath)
	if len(items) == 0 {
		return nil, newUID, nil
	}

	reason := reasonForMetadataAction(action)
	var replaced []replacedFolder
	for _, item := range items {
		if newUID == item.Name {
			continue
		}
		replaced = append(replaced, replacedFolder{
			Path:   folderPath,
			OldUID: item.Name,
			Reason: reason,
		})
	}
	return replaced, newUID, nil
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
			Reason: provisioning.ReasonFolderMetadataDeleted,
		}
	}

	fallbackUID := resources.ParseFolder(folderPath, d.repo.Config().Name).ID
	if fallbackUID == existing.Name {
		return nil
	}

	return &replacedFolder{
		Path:   folderPath,
		OldUID: existing.Name,
		Reason: provisioning.ReasonFolderMetadataDeleted,
	}
}

// folderPathForMetadataChange converts a `_folder.json` file path into the
// normalized folder path used by managed-resource lookups and synthetic diff
// entries.
func folderPathForMetadataChange(metadataPath string) string {
	return safepath.EnsureTrailingSlash(safepath.Dir(metadataPath))
}

// isFolderRelocating reports whether a folder with the given name is genuinely
// moving from another path to targetPath in this diff without any UID change.
func isFolderRelocating(index managedResourceIndex, input folderMetadataDiffSplit, activeUIDs map[string]struct{}, name, targetPath string) bool {
	if _, alreadyClaimed := activeUIDs[name]; alreadyClaimed {
		return false
	}
	for _, item := range index.ExistingByName(name) {
		if item.Group != resources.FolderResource.Group {
			continue
		}
		sourcePath := safepath.EnsureTrailingSlash(item.Path)
		if sourcePath == targetPath {
			continue
		}
		if input.IsMetadataVacatingAt(sourcePath) || input.HadChangeOriginallyAt(sourcePath) {
			return true
		}
	}
	return false
}
