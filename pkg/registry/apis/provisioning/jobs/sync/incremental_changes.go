package sync

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// IncrementalChangesResult collects the artifacts produced by converting a
// repository git diff into the apply-ready ResourceFileChange list, alongside
// the side outputs (replaced folders, invalid metadata) that the incremental
// sync flow consumes after apply.
type IncrementalChangesResult struct {
	Changes               []ResourceFileChange
	ReplacedFolders       []replacedFolder
	InvalidFolderMetadata []*resources.InvalidFolderMetadata
}

// IncrementalChanges turns a repository-side git diff into the diff against
// Grafana — the same shape full sync feeds into the apply pipeline. The
// converter is the incremental analogue of compare.go's Compare(): both
// produce a []ResourceFileChange that the shared apply engine consumes.
//
// When folderMetadataEnabled, this:
//   - runs the FolderMetadataIncrementalDiffBuilder to expand `_folder.json`
//     events into folder/child reparenting changes,
//   - seeds the in-memory folder tree from the managed resource list so apply
//     can look up existing folders by path and respect their UIDs.
//
// The function is read-only: it does not mutate Grafana or the repository.
// Mutations happen in the shared applyChanges pipeline that consumes its
// output.
func IncrementalChanges(
	ctx context.Context,
	repo repository.Versioned,
	repositoryResources resources.RepositoryResources,
	currentRef string,
	diff []repository.VersionedFileChange,
	folderMetadataEnabled bool,
) (IncrementalChangesResult, error) {
	result := IncrementalChangesResult{}

	relocations := map[string][]string{}

	if folderMetadataEnabled && len(diff) > 0 {
		readerRepo, ok := repo.(repository.Reader)
		if !ok {
			return result, fmt.Errorf("folder metadata incremental sync requires repository.Reader")
		}

		target, err := repositoryResources.List(ctx)
		if err != nil {
			return result, fmt.Errorf("list managed resources: %w", err)
		}

		builder := NewFolderMetadataIncrementalDiffBuilder(readerRepo)
		var augmented []repository.VersionedFileChange
		augmented, relocations, result.ReplacedFolders, result.InvalidFolderMetadata, err = builder.BuildIncrementalDiff(ctx, currentRef, diff, target)
		if err != nil {
			return result, fmt.Errorf("build folder metadata incremental diff: %w", err)
		}
		diff = augmented

		// Incremental sync normally starts with an empty folder tree; folder
		// metadata handling needs the current managed path->UID state before
		// apply so invalid `_folder.json` falls back to the existing folder at
		// that path and folders cannot overtake existing UIDs.
		repositoryResources.SetTree(resources.NewFolderTreeFromResourceList(target))
	}

	// We don't need an index lookup for incremental converts in the current
	// design, but constructing it would let us populate ResourceFileChange.Existing
	// for richer diagnostics or to migrate Update/Delete to the full-sync
	// primitives in a follow-up. Keep the conversion list-based for now.

	result.Changes = make([]ResourceFileChange, 0, len(diff))
	for _, change := range diff {
		expanded, err := convertVersionedChange(change, relocations)
		if err != nil {
			return result, err
		}
		result.Changes = append(result.Changes, expanded...)
	}

	return result, nil
}

// convertVersionedChange maps a single repository-side change into one or more
// ResourceFileChange entries the shared apply pipeline can consume. Most
// changes map 1:1; unsupported paths expand to either a folder Created at the
// safe segment (when one exists) or an Ignored entry preserving incremental
// sync's "still record progress for unsupported paths" behavior.
func convertVersionedChange(change repository.VersionedFileChange, relocations map[string][]string) ([]ResourceFileChange, error) {
	if err := resources.IsPathSupported(change.Path); err != nil {
		return convertUnsupportedPath(change), nil
	}

	// Directory entries (trailing-slash paths) with Created/Deleted actions are
	// produced by cross-boundary renames; their file-level counterparts already
	// handle folder creation (EnsureFolderPathExist from WriteResourceFromFile)
	// and deletion (via affectedFolders / orphan cleanup). Emit a record-only
	// entry so the job progress total matches the raw diff while the shared
	// apply pipeline skips any folder operation on them.
	if safepath.IsDir(change.Path) &&
		change.Action != repository.FileActionRenamed &&
		change.Action != repository.FileActionUpdated {
		return []ResourceFileChange{{
			Path:       change.Path,
			Action:     change.Action,
			Ref:        change.Ref,
			RecordOnly: true,
		}}, nil
	}

	out := ResourceFileChange{
		Path:         change.Path,
		Action:       change.Action,
		PreviousPath: change.PreviousPath,
		Ref:          change.Ref,
		PreviousRef:  change.PreviousRef,
	}

	// Attach cumulative relocating UIDs so apply can pass them through to
	// EnsureFolderPathExist/RenameFolderPath/RenameResourceFile and bypass
	// the ID conflict check at the new path.
	switch {
	case change.Action == repository.FileActionUpdated && safepath.IsDir(change.Path):
		// Re-parent expansion produced by the metadata rebuilder. Relocating
		// UIDs at the exact path describe the children that must be re-anchored.
		if uids, ok := relocations[change.Path]; ok && len(uids) > 0 {
			out.RelocatingUIDs = append(out.RelocatingUIDs, uids...)
		}

	case change.Action == repository.FileActionRenamed && safepath.IsDir(change.Path):
		out.RelocatingUIDs = append(out.RelocatingUIDs, ancestorRelocations(safepath.Dir(change.Path), relocations)...)

	case change.Action == repository.FileActionRenamed && !safepath.IsDir(change.Path):
		startDir := safepath.EnsureTrailingSlash(safepath.Dir(change.Path))
		out.RelocatingUIDs = append(out.RelocatingUIDs, ancestorRelocations(startDir, relocations)...)
	}

	return []ResourceFileChange{out}, nil
}

// ancestorRelocations walks from start up to the repository root and collects
// any relocating UIDs registered for the visited folder paths. Mirrors the
// pre-refactor incremental behavior of accumulating relocations along the
// chain so nested moves preserve their bypass list.
func ancestorRelocations(start string, relocations map[string][]string) []string {
	var uids []string
	for dir := start; dir != ""; dir = safepath.Dir(dir) {
		if u, ok := relocations[dir]; ok {
			uids = append(uids, u...)
		}
	}
	return uids
}

// convertUnsupportedPath expands a change for an unsupported path into either
// a folder creation at the safe segment (so empty folder trees still get
// materialised) or an ignored placeholder. The shared apply path then records
// progress for each entry just as the pre-refactor incremental loop did.
func convertUnsupportedPath(change repository.VersionedFileChange) []ResourceFileChange {
	safeSegment := safepath.SafeSegment(change.Path)
	if !safepath.IsDir(safeSegment) {
		safeSegment = safepath.Dir(safeSegment)
	}

	if safeSegment != "" && resources.IsPathSupported(safeSegment) == nil {
		return []ResourceFileChange{{
			Path:                   change.Path,
			Action:                 repository.FileActionCreated,
			Ref:                    change.Ref,
			UnsupportedSafeSegment: safeSegment,
		}}
	}

	return []ResourceFileChange{{
		Path:   change.Path,
		Action: repository.FileActionIgnored,
	}}
}

// PopulateExistingFromManaged is a small helper that fills in Existing on
// changes whose path matches a managed resource. It is not used by the
// current incremental flow (which dispatches on PreviousRef), but is exposed
// for callers who want to emit full-sync-style changes from a diff: e.g. a
// future unification that drops the incremental primitives entirely.
func PopulateExistingFromManaged(changes []ResourceFileChange, target *provisioning.ResourceList) {
	if target == nil || len(changes) == 0 {
		return
	}
	index := newManagedResourceIndex(target)
	for i := range changes {
		path := changes[i].Path
		if changes[i].Action == repository.FileActionRenamed && changes[i].PreviousPath != "" {
			path = changes[i].PreviousPath
		}
		items := index.ExistingAt(path)
		if len(items) == 1 {
			changes[i].Existing = items[0]
		}
	}
}
