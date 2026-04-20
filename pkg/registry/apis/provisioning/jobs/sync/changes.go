package sync

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

type ResourceFileChange struct {
	// Path to the file in a repository with a change
	Path   string
	Action repository.FileAction

	// PreviousPath is the source path for Renamed changes when the rename was
	// detected by the repository (incremental sync). DetectRenames-produced
	// renames in full sync leave this empty and rely on Existing.Path instead.
	PreviousPath string

	// Ref is the ref at which the new-side content should be read. When empty,
	// apply falls back to the outer currentRef. Incremental changes populate
	// this from VersionedFileChange.Ref.
	Ref string

	// PreviousRef is populated for incremental-originated Deleted/Updated/Renamed
	// changes so apply can dispatch to the previous-ref-aware primitives
	// (RemoveResourceFromFile, ReplaceResourceFromFileByRef, RenameResourceFile).
	// Empty on full-sync-originated changes, which use the managed-list Existing
	// identity to drive the equivalent primitives.
	PreviousRef string

	// The current value in the database -- only required for delete
	Existing *provisioning.ResourceListItem

	// Hash is the source-side content hash from the repository tree.
	// Populated for FileActionCreated entries so DetectRenames can match
	// them against deletions without reading file content.
	Hash string

	// FolderRenamed is set when folder metadata reconciliation changes the folder ID
	// (for example, a UID change in _folder.json or reverting to a hash-based ID
	// after _folder.json deletion). The old folder needs cleanup after children
	// have been re-parented.
	FolderRenamed bool

	// Reason provides an explicit reason for folder replacement changes
	// (e.g. ReasonFolderMetadataUpdated, ReasonFolderMetadataDeleted).
	Reason string

	// OrphanCleanup marks deletions emitted to clean up duplicate-path orphans.
	// DetectRenames must skip these so orphan removal is not consumed as a rename.
	OrphanCleanup bool

	// RelocatingUIDs carries per-change folder UID allowlists that must bypass
	// the ID-conflict check when the folder is re-parented or relocated in this
	// sync. Populated by the incremental converter from the folder-metadata
	// rebuilder's relocations map; full sync's equivalent is inlined via
	// the FolderRenamed Existing name.
	RelocatingUIDs []string

	// RecordOnly marks a change that should be recorded in job progress with
	// its Action and Path (and no side effect on Grafana). This preserves
	// incremental sync's behavior of emitting Created/Deleted records for
	// directory entries produced by cross-boundary renames while skipping the
	// actual folder operation — the individual file-level changes already
	// handle folder creation (via EnsureFolderPathExist) and deletion (via
	// affectedFolders / orphan cleanup).
	RecordOnly bool

	// UnsupportedSafeSegment marks an incremental-origin change whose path is
	// unsupported but whose safe segment is. apply checks skip state against
	// Path (the original unsupported file path) and then creates the folder
	// at UnsupportedSafeSegment, recording the result at that path. This
	// mirrors pre-refactor incremental behavior where HasDirPathFailedCreation
	// ran against the raw diff path even though the folder was materialised
	// at the safe ancestor.
	UnsupportedSafeSegment string
}

// IsUpdatedFolder reports whether this change is an update to an existing folder.
func (c *ResourceFileChange) IsUpdatedFolder() bool {
	return c.Action == repository.FileActionUpdated &&
		safepath.IsDir(c.Path) &&
		c.Existing != nil
}

// Compare reads the repository tree at ref, lists the current Grafana resources,
// and delegates to Changes to produce the diff. It also returns the list of
// folder paths that are missing a _folder.json metadata file, plus any invalid
// folder metadata warnings detected during compare.
func Compare(
	ctx context.Context,
	repo repository.Reader,
	repositoryResources resources.RepositoryResources,
	ref string,
	folderMetadataEnabled bool,
) ([]ResourceFileChange, []string, []*resources.InvalidFolderMetadata, error) {
	target, err := repositoryResources.List(ctx)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("error listing current: %w", err)
	}

	source, err := repo.ReadTree(ctx, ref)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("error reading tree: %w", err)
	}

	changes, err := Changes(ctx, source, target, folderMetadataEnabled)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("calculate changes: %w", err)
	}

	var invalidFolderMetadata []*resources.InvalidFolderMetadata
	if folderMetadataEnabled {
		changes, invalidFolderMetadata, err = augmentChangesForFolderMetadata(ctx, repo, ref, source, target, changes)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("augment changes for folder metadata: %w", err)
		}

		changes, err = augmentChangesForFolderMoves(ctx, repo, ref, changes)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("augment changes for folder moves: %w", err)
		}
	}

	if len(changes) > 0 {
		// FIXME: this is a way to load in different ways the resources
		// maybe we can structure the code in better way to avoid this
		repositoryResources.SetTree(resources.NewFolderTreeFromResourceList(target))
	}

	missingMetadata := resources.FindFoldersMissingMetadata(source)

	return changes, missingMetadata, invalidFolderMetadata, nil
}

// Changes computes the diff between a repository source tree and the current Grafana state (target).
//
//nolint:gocyclo
func Changes(
	ctx context.Context,
	source []repository.FileTreeEntry,
	target *provisioning.ResourceList,
	folderMetadataEnabled bool,
) ([]ResourceFileChange, error) {
	logger := logging.FromContext(ctx)
	lookup := make(map[string][]*provisioning.ResourceListItem, len(target.Items))
	for i := range target.Items {
		item := &target.Items[i]
		if item.Path == "" {
			if item.Group != resources.FolderResource.Group {
				return nil, fmt.Errorf("empty path on a non folder")
			}
			continue
		}

		// TODO: why do we have to do this here?
		if item.Group == resources.FolderResource.Group && !strings.HasSuffix(item.Path, "/") {
			item.Path = item.Path + "/"
		}

		lookup[item.Path] = append(lookup[item.Path], item)
	}

	keep := safepath.NewTrie()
	changes := make([]ResourceFileChange, 0, len(source))

	for _, file := range source {
		// TODO: why do we have to do this here?
		if !file.Blob && !strings.HasSuffix(file.Path, "/") {
			file.Path = file.Path + "/"
		}

		items, ok := lookup[file.Path]
		if ok {
			// Pick the best match: prefer the item whose hash matches the
			// source file (preserves K8s UID). Fall back to the first item.
			primary := items[0]
			for _, item := range items {
				if item.Hash == file.Hash {
					primary = item
					break
				}
			}

			// Emit deletions for orphan duplicates at this path.
			// Skip folder resources: directory tree hashes don't match the
			// _folder.json blob hash stored on managed folders, so the
			// primary selection above is unreliable for folders. Folder
			// orphan cleanup is handled by augmentChangesForFolderMetadata
			// (full sync) and the incremental diff builder.
			if primary.Resource != resources.FolderResource.Resource {
				for _, item := range items {
					if item == primary {
						continue
					}
					logger.Warn("deleting orphan resource at duplicate path", "path", item.Path, "name", item.Name)
					changes = append(changes, ResourceFileChange{
						Action:        repository.FileActionDeleted,
						Path:          item.Path,
						Existing:      item,
						OrphanCleanup: true,
					})
				}
			}

			if primary.Hash != file.Hash && primary.Resource != resources.FolderResource.Resource {
				changes = append(changes, ResourceFileChange{
					Action:   repository.FileActionUpdated,
					Path:     primary.Path,
					Existing: primary,
				})
			}

			if err := keep.Add(file.Path); err != nil {
				return nil, fmt.Errorf("failed to add path to keep trie: %w", err)
			}

			if primary.Resource != resources.FolderResource.Resource {
				delete(lookup, file.Path)
			}

			continue
		}

		if resources.IsPathSupported(file.Path) == nil {
			// The folder metadata file is not a resource itself.
			// For new folders the parent directory creation handles it;
			// for existing folders we compare hashes to detect metadata changes.
			if resources.IsFolderMetadataFile(file.Path) {
				if !folderMetadataEnabled {
					logger.Debug("skipping folder metadata file as feature flag is off", "path", file.Path)
					if err := keep.Add(file.Path); err != nil {
						return nil, fmt.Errorf("failed to add path to keep folder metadata file: %w", err)
					}
					continue
				}

				logger.Debug("processing folder metadata file", "path", file.Path)
				if err := keep.Add(file.Path); err != nil {
					return nil, fmt.Errorf("failed to add path to keep folder metadata file: %w", err)
				}
				// If the parent directory already exists in Grafana and the hash changed,
				// record an update to reconcile metadata (e.g. folder title).
				// When multiple managed folders share the path (orphans), pick the
				// one whose metadata hash matches the new _folder.json content so
				// we target the correct UID, and delete the rest as orphans.
				// This is the correct place for folder orphan cleanup because
				// file.Hash (_folder.json blob hash) is directly comparable to
				// managed folder hashes (sourceChecksum derived from MetadataHash).
				parentDir := safepath.Dir(file.Path)
				if !strings.HasSuffix(parentDir, "/") {
					parentDir += "/"
				}
				if parentItems, ok := lookup[parentDir]; ok && len(parentItems) > 0 {
					best := parentItems[0]
					for _, p := range parentItems {
						if p.Hash == file.Hash {
							best = p
							break
						}
					}
					for _, p := range parentItems {
						if p == best {
							continue
						}
						logger.Warn("deleting orphan folder at duplicate path", "path", p.Path, "name", p.Name)
						changes = append(changes, ResourceFileChange{
							Action:        repository.FileActionDeleted,
							Path:          parentDir,
							Existing:      p,
							OrphanCleanup: true,
						})
					}
					if best.Hash != file.Hash {
						changes = append(changes, ResourceFileChange{
							Action:   repository.FileActionUpdated,
							Path:     parentDir,
							Existing: best,
						})
					}
				}
				continue
			}

			changes = append(changes, ResourceFileChange{
				Action: repository.FileActionCreated,
				Path:   file.Path,
				Hash:   file.Hash,
			})

			if err := keep.Add(file.Path); err != nil {
				return nil, fmt.Errorf("failed to add path to keep trie: %w", err)
			}

			continue
		}

		// Maintain the safe segment for empty folders
		safeSegment := safepath.SafeSegment(file.Path)
		if !safepath.IsDir(safeSegment) {
			safeSegment = safepath.Dir(safeSegment)
		}

		if safeSegment != "" && resources.IsPathSupported(safeSegment) == nil {
			if err := keep.Add(safeSegment); err != nil {
				return nil, fmt.Errorf("failed to add path to keep trie: %w", err)
			}

			if _, ok := lookup[safeSegment]; ok {
				continue
			}

			// Ignore file change for `.keep` folders
			if strings.HasSuffix(file.Path, ".keep") {
				continue
			}

			changes = append(changes, ResourceFileChange{
				Action: repository.FileActionCreated,
				Path:   safeSegment,
				Hash:   file.Hash,
			})
		}
	}

	// Paths found in grafana, without a matching path in the repository
	for _, items := range lookup {
		for _, v := range items {
			if v.Resource == resources.FolderResource.Resource && keep.Exists(v.Path) {
				continue
			}

			changes = append(changes, ResourceFileChange{
				Action:   repository.FileActionDeleted,
				Path:     v.Path,
				Existing: v,
			})
		}
	}

	// Deepest first (stable sort order)
	safepath.SortByDepth(changes, func(c ResourceFileChange) string { return c.Path }, false)

	return changes, nil
}

// augmentChangesForFolderMetadata detects two categories of folder metadata changes:
// (1) folders whose _folder.json was deleted, and (2) folders whose _folder.json UID
// changed. In both cases, direct children are emitted as FileActionUpdated so they
// are re-parented during the normal apply flow.
func augmentChangesForFolderMetadata(
	ctx context.Context,
	repo repository.Reader,
	ref string,
	source []repository.FileTreeEntry,
	target *provisioning.ResourceList,
	changes []ResourceFileChange,
) ([]ResourceFileChange, []*resources.InvalidFolderMetadata, error) {
	sourceFolders, foldersWithMetadata := buildSourceMetadataIndex(source)
	changes, invalidFolderMetadata, err := processInvalidFolderMetadataChanges(ctx, repo, ref, changes, foldersWithMetadata)
	if err != nil {
		return nil, nil, err
	}

	pathsWithChanges := make(map[string]bool, len(changes))
	for _, c := range changes {
		// Exclude DELETE actions: emitDirectChildrenChanges iterates source
		// tree entries, so files deleted from source won't appear there.
		// Only orphan-cleanup deletes (where the source file still exists)
		// would land here, and those must not suppress the reparent UPDATE
		// that the surviving primary needs when a parent folder UID changes.
		if c.Action == repository.FileActionDeleted {
			continue
		}
		pathsWithChanges[c.Path] = true
	}

	affectedFolders := make(map[string]bool)

	// Detect folders whose _folder.json was deleted.
	deletedChanges, deletedAffected := detectDeletedFolderMetadata(target, sourceFolders, foldersWithMetadata, pathsWithChanges)
	for _, change := range deletedChanges {
		pathsWithChanges[change.Path] = true
	}
	changes = append(changes, deletedChanges...)
	affectedFolders = mergeAffectedFolders(affectedFolders, deletedAffected)

	// Detect folders whose _folder.json UID changed.
	uidAffected, err := detectFolderUIDChanges(ctx, repo, ref, changes)
	if err != nil {
		return nil, nil, err
	}
	affectedFolders = mergeAffectedFolders(affectedFolders, uidAffected)

	// No folders will be renamed, so we can return the changes as is.
	if len(affectedFolders) == 0 {
		return changes, invalidFolderMetadata, nil
	}

	// Emit children for re-parenting and re-sort by path depth.
	changes = emitDirectChildrenChanges(source, target, pathsWithChanges, affectedFolders, changes)
	safepath.SortByDepth(changes, func(c ResourceFileChange) string { return c.Path }, false)
	return changes, invalidFolderMetadata, nil
}

// processInvalidFolderMetadataChanges performs a single metadata read for each
// created/updated folder path that currently has a _folder.json file. Invalid
// metadata is surfaced as warnings. Existing-folder updates are suppressed so
// the current folder UID is preserved; brand-new folders keep their created
// change so apply can fall back to the hash-derived folder identity.
func processInvalidFolderMetadataChanges(
	ctx context.Context,
	repo repository.Reader,
	ref string,
	changes []ResourceFileChange,
	foldersWithMetadata map[string]bool,
) ([]ResourceFileChange, []*resources.InvalidFolderMetadata, error) {
	// First pass: validate metadata and collect folder paths with invalid
	// _folder.json so we can also suppress orphan-cleanup deletes there.
	invalidPaths := make(map[string]bool)
	filtered := make([]ResourceFileChange, 0, len(changes))
	var invalidFolderMetadata []*resources.InvalidFolderMetadata

	for _, change := range changes {
		if !safepath.IsDir(change.Path) || (change.Action != repository.FileActionCreated && change.Action != repository.FileActionUpdated) {
			filtered = append(filtered, change)
			continue
		}
		if !foldersWithMetadata[change.Path] {
			filtered = append(filtered, change)
			continue
		}

		_, _, err := resources.ReadFolderMetadata(ctx, repo, change.Path, ref)
		if err == nil {
			filtered = append(filtered, change)
			continue
		}

		var invalidErr *resources.InvalidFolderMetadata
		if errors.As(err, &invalidErr) {
			logging.FromContext(ctx).Info("invalid folder metadata", "path", change.Path, "action", change.Action, "error", err)
			invalidErr = invalidErr.WithAction(change.Action)
			invalidFolderMetadata = append(invalidFolderMetadata, invalidErr)
			invalidPaths[change.Path] = true
			if change.Action == repository.FileActionCreated {
				filtered = append(filtered, change)
			}
			continue
		}

		if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
			filtered = append(filtered, change)
			continue
		}

		return nil, nil, fmt.Errorf("read folder metadata for %s: %w", change.Path, err)
	}

	// Second pass: suppress orphan-cleanup deletes at folder paths whose
	// metadata is invalid — the hash-based primary selection is unreliable
	// when the _folder.json content can't be parsed.
	if len(invalidPaths) > 0 {
		logger := logging.FromContext(ctx)
		kept := make([]ResourceFileChange, 0, len(filtered))
		for _, c := range filtered {
			if c.OrphanCleanup && safepath.IsDir(c.Path) && invalidPaths[c.Path] {
				logger.Info("suppressing orphan cleanup for folder with invalid metadata", "path", c.Path)
				continue
			}
			kept = append(kept, c)
		}
		filtered = kept
	}

	return filtered, invalidFolderMetadata, nil
}

// buildSourceMetadataIndex performs a single pass over the source tree, returning
// which directories exist and which contain a _folder.json metadata file.
func buildSourceMetadataIndex(source []repository.FileTreeEntry) (map[string]bool, map[string]bool) {
	sourceFolders := make(map[string]bool)
	foldersWithMetadata := make(map[string]bool)
	for _, file := range source {
		if !file.Blob {
			path := safepath.EnsureTrailingSlash(file.Path)
			sourceFolders[path] = true
		} else if resources.IsFolderMetadataFile(file.Path) {
			if parent := safepath.Dir(file.Path); parent != "" {
				foldersWithMetadata[parent] = true
			}
		}
	}
	return sourceFolders, foldersWithMetadata
}

func mergeAffectedFolders(dst, src map[string]bool) map[string]bool {
	if len(src) == 0 {
		return dst
	}
	if dst == nil {
		dst = make(map[string]bool, len(src))
	}
	for path := range src {
		dst[path] = true
	}
	return dst
}

// detectDeletedFolderMetadata finds folders in target that had metadata (non-empty Hash)
// but whose _folder.json is now absent from source (while the directory still exists).
// It emits FileActionUpdated with FolderRenamed=true.
func detectDeletedFolderMetadata(
	target *provisioning.ResourceList,
	sourceFolders, foldersWithMetadata map[string]bool,
	pathsWithChanges map[string]bool,
) ([]ResourceFileChange, map[string]bool) {
	var changes []ResourceFileChange
	affectedFolders := make(map[string]bool)

	for i := range target.Items {
		item := &target.Items[i]

		// Non-folder resources or resources without a metadata file already are not affected.
		if item.Group != resources.FolderResource.Group || item.Hash == "" {
			continue
		}

		path := safepath.EnsureTrailingSlash(item.Path)
		if path == "" {
			continue // root folder doesn't contain metadata and doesn't need to be renamed
		}
		if !sourceFolders[path] {
			continue // entire folder deleted — handled by normal flow
		}
		if foldersWithMetadata[path] {
			continue // metadata still exists
		}
		if pathsWithChanges[path] {
			continue // this path is already marked for update
		}

		changes = append(changes, ResourceFileChange{
			Action:        repository.FileActionUpdated,
			Path:          path,
			Existing:      item,
			FolderRenamed: true,
			Reason:        provisioning.ReasonFolderMetadataDeleted,
		})
		affectedFolders[path] = true
	}
	return changes, affectedFolders
}

// detectFolderUIDChanges iterates existing folder update changes, reads their
// _folder.json and compares the UID.
// Returns a map of the folder paths that will be renamed.
func detectFolderUIDChanges(
	ctx context.Context,
	repo repository.Reader,
	ref string,
	changes []ResourceFileChange,
) (map[string]bool, error) {
	affectedFolders := make(map[string]bool)
	for i := range changes {
		change := &changes[i]

		// Skip if the folder was not marked as updated or if it was already marked for renaming.
		if !change.IsUpdatedFolder() || change.FolderRenamed {
			continue
		}

		meta, _, err := resources.ReadFolderMetadata(ctx, repo, change.Path, ref)
		if err != nil {
			// Metadata file not found, meaning the folder has no metadata, skipping.
			if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
				continue
			}
			return nil, fmt.Errorf("read folder metadata for %s: %w", change.Path, err)
		}

		// If the metadata file exists, check if the UID has changed.
		if meta.Name != change.Existing.Name {
			logging.FromContext(ctx).Info("folder UID change detected",
				"path", change.Path,
				"oldUID", change.Existing.Name,
				"newUID", meta.Name,
			)
			path := safepath.EnsureTrailingSlash(change.Path)
			affectedFolders[path] = true
			change.FolderRenamed = true
			if change.Existing.Hash == "" {
				change.Reason = provisioning.ReasonFolderMetadataCreated
			} else {
				change.Reason = provisioning.ReasonFolderMetadataUpdated
			}
		}
	}
	return affectedFolders, nil
}

// DetectRenames finds delete+create pairs whose content hash matches and
// collapses them into a single FileActionRenamed change. This preserves the
// K8s UID, creationTimestamp, and generation when a file is moved/renamed in
// the repo without changing its content.
//
// Matching uses the source checksum stored on the existing resource
// (Existing.Hash) and the repository tree hash carried on created entries
// (Hash). Only simple renames (content unchanged) are detected; if the
// content also changed the pair remains as separate delete + create.
//
// When multiple deleted resources share the same hash the match is ambiguous
// (we cannot determine which deletion corresponds to the new file), so all
// entries with that hash are left as separate delete + create operations.
//
// Folder paths are skipped because folder renames are handled separately by
// augmentChangesForFolderMetadata.
func DetectRenames(changes []ResourceFileChange) []ResourceFileChange {
	deletionsByHash := make(map[string]int)
	ambiguous := make(map[string]bool)
	for i, change := range changes {
		if change.Action != repository.FileActionDeleted || change.Existing == nil {
			continue
		}
		if change.OrphanCleanup {
			continue
		}
		if safepath.IsDir(change.Path) || change.Existing.Hash == "" {
			continue
		}
		// Track hashes seen more than once so we can discard them below.
		if _, exists := deletionsByHash[change.Existing.Hash]; exists {
			ambiguous[change.Existing.Hash] = true
		}
		deletionsByHash[change.Existing.Hash] = i
	}
	// Remove ambiguous hashes: when multiple deletions share the same hash
	// we cannot reliably pick the right one, so skip them entirely.
	for h := range ambiguous {
		delete(deletionsByHash, h)
	}

	if len(deletionsByHash) == 0 {
		return changes
	}

	removedDeletions := make(map[int]bool)
	for i, change := range changes {
		if change.Action != repository.FileActionCreated || change.Hash == "" {
			continue
		}
		if safepath.IsDir(change.Path) {
			continue
		}

		deletionIdx, found := deletionsByHash[change.Hash]
		if !found {
			continue
		}

		changes[i] = ResourceFileChange{
			Action:   repository.FileActionRenamed,
			Path:     change.Path,
			Hash:     change.Hash,
			Existing: changes[deletionIdx].Existing,
		}
		removedDeletions[deletionIdx] = true
		delete(deletionsByHash, change.Hash)
	}

	if len(removedDeletions) == 0 {
		return changes
	}

	result := make([]ResourceFileChange, 0, len(changes)-len(removedDeletions))
	for i, change := range changes {
		if !removedDeletions[i] {
			result = append(result, change)
		}
	}
	return result
}

// emitDirectChildrenChanges iterates the source tree and emits FileActionUpdated for
// direct children of affected folders that exist in target but aren't already in changes.
func emitDirectChildrenChanges(
	source []repository.FileTreeEntry,
	target *provisioning.ResourceList,
	pathsWithChanges, affectedFolders map[string]bool,
	changes []ResourceFileChange,
) []ResourceFileChange {
	existingByPath := make(map[string][]*provisioning.ResourceListItem, len(target.Items))
	for i := range target.Items {
		item := &target.Items[i]

		path := item.Path
		if item.Group == resources.FolderResource.Group {
			path = safepath.EnsureTrailingSlash(path)
		}

		existingByPath[path] = append(existingByPath[path], item)
	}

	// Collect items already targeted by a DELETE so we can skip them when
	// selecting the best match for reparent updates. Keyed by pointer
	// identity (all items reference target.Items) rather than Name alone,
	// since Name is only unique within a (Group, Resource) and different
	// resource kinds can share the same name.
	deletedItems := make(map[*provisioning.ResourceListItem]bool, len(changes))
	for _, c := range changes {
		if c.Action == repository.FileActionDeleted && c.Existing != nil {
			deletedItems[c.Existing] = true
		}
	}

	for _, file := range source {
		path := file.Path
		if !file.Blob {
			path = safepath.EnsureTrailingSlash(path)
		}

		// Not emit update for metadata files.
		if resources.IsFolderMetadataFile(path) {
			continue
		}

		parentDir := safepath.Dir(path)
		// If the directory of given resource is not being renamed, skip
		if !affectedFolders[parentDir] {
			continue
		}

		// If the specific resource path has already been marked for update, skip
		if pathsWithChanges[path] {
			continue
		}

		items, ok := existingByPath[path]
		// If the resource path doesn't exist in Grafana, it means it's new
		// therefore it doesn't need to be updated.
		if !ok || len(items) == 0 {
			continue
		}
		best := items[0]
		for _, it := range items {
			if deletedItems[it] {
				continue
			}
			if it.Hash == file.Hash {
				best = it
				break
			}
			if deletedItems[best] {
				best = it
			}
		}
		changes = append(changes, ResourceFileChange{
			Action:   repository.FileActionUpdated,
			Path:     path,
			Existing: best,
		})
		pathsWithChanges[path] = true
	}

	return changes
}

// augmentChangesForFolderMoves detects metadata-backed folder moves where the
// directory path changed but the UID in _folder.json stayed the same. The initial
// diff produces a DELETE (old path) and a CREATE (new path); this function merges
// them into a single UPDATE so the folder is updated in-place instead of being
// deleted and recreated (which would reset the K8s generation). Invalid
// metadata is left as a normal delete+create sequence because the move cannot be
// matched safely.
func augmentChangesForFolderMoves(
	ctx context.Context,
	repo repository.Reader,
	ref string,
	changes []ResourceFileChange,
) ([]ResourceFileChange, error) {
	deletedFolders := make(map[string]int) // UID -> index in changes
	var createIndices []int

	for i, c := range changes {
		if !safepath.IsDir(c.Path) {
			continue
		}
		if c.Action == repository.FileActionDeleted && c.Existing != nil {
			deletedFolders[c.Existing.Name] = i
		} else if c.Action == repository.FileActionCreated {
			createIndices = append(createIndices, i)
		}
	}

	if len(deletedFolders) == 0 || len(createIndices) == 0 {
		return changes, nil
	}

	removedIndices := make(map[int]bool)
	for _, ci := range createIndices {
		create := &changes[ci]
		meta, _, err := resources.ReadFolderMetadata(ctx, repo, create.Path, ref)
		if err != nil {
			if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
				continue
			}
			if errors.Is(err, resources.ErrInvalidFolderMetadata) {
				continue
			}
			return nil, fmt.Errorf("read folder metadata for %s: %w", create.Path, err)
		}
		if meta.Name == "" {
			continue
		}

		idx, ok := deletedFolders[meta.Name]
		if !ok {
			continue
		}

		// Same UID at a different path: convert CREATE to UPDATE.
		logging.FromContext(ctx).Info("folder move detected",
			"uid", meta.Name,
			"oldPath", changes[idx].Path,
			"newPath", create.Path,
		)
		create.Action = repository.FileActionUpdated
		create.Existing = changes[idx].Existing
		removedIndices[idx] = true
		delete(deletedFolders, meta.Name)
	}

	if len(removedIndices) == 0 {
		return changes, nil
	}

	filtered := make([]ResourceFileChange, 0, len(changes)-len(removedIndices))
	for i, c := range changes {
		if !removedIndices[i] {
			filtered = append(filtered, c)
		}
	}

	safepath.SortByDepth(filtered, func(c ResourceFileChange) string { return c.Path }, false)
	return filtered, nil
}
