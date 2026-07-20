package sync

import "github.com/grafana/grafana/apps/provisioning/pkg/repository"

// rebuiltIncrementalDiffTracker accumulates the rewritten diff and tracks generated
// paths so we do not emit duplicate changes while expanding metadata changes.
type rebuiltIncrementalDiffTracker struct {
	filteredDiff   []repository.VersionedFileChange
	generatedPaths map[string]struct{}
	replaced       []replacedFolder
	activeUIDs     map[string]struct{}
	relocations    map[string][]string // targetPath → UIDs relocating there
}

// newRebuiltIncrementalDiff seeds the rewritten diff with changes
// and prepares tracking for generated paths and replaced or relocated folders.
func newRebuiltIncrementalDiffTracker(changes []repository.VersionedFileChange) *rebuiltIncrementalDiffTracker {
	return &rebuiltIncrementalDiffTracker{
		filteredDiff:   changes,
		generatedPaths: make(map[string]struct{}),
		replaced:       make([]replacedFolder, 0),
		activeUIDs:     make(map[string]struct{}),
		relocations:    make(map[string][]string),
	}
}

// HasGeneratedPath reports whether the rebuilder has already emitted a
// synthetic change for the provided path.
func (result *rebuiltIncrementalDiffTracker) HasGeneratedPath(path string) bool {
	_, ok := result.generatedPaths[path]
	return ok
}

// Append adds a synthetic change to the rewritten diff and marks its path as
// generated so later expansions do not emit duplicates.
func (result *rebuiltIncrementalDiffTracker) Append(change repository.VersionedFileChange) {
	result.filteredDiff = append(result.filteredDiff, change)
	result.generatedPaths[change.Path] = struct{}{}
}

// AppendReplaced records an old folder identity that must be deleted after the
// rewritten diff has been applied successfully.
func (result *rebuiltIncrementalDiffTracker) AppendReplaced(replaced replacedFolder) {
	result.replaced = append(result.replaced, replaced)
}

// TrackRelocation records a UID that is being actively assigned to targetPath
// by a metadata change in this diff. UIDs in this set must not be deleted
// even if they appear in the replaced list (the UID moved between paths
// rather than being removed).
func (result *rebuiltIncrementalDiffTracker) TrackRelocation(targetPath, uid string) {
	result.activeUIDs[uid] = struct{}{}
	result.relocations[targetPath] = append(result.relocations[targetPath], uid)
}

func (result *rebuiltIncrementalDiffTracker) IsActiveUID(uid string) bool {
	_, ok := result.activeUIDs[uid]
	return ok
}

// Relocations returns a mapping from target folder path to the UIDs that are
// relocating there. Callers thread these per-path allowlists into
// EnsureFolderPathExist via WithRelocatingUIDs.
func (result *rebuiltIncrementalDiffTracker) Relocations() map[string][]string {
	return result.relocations
}

func (result *rebuiltIncrementalDiffTracker) IncrementalDiff() []repository.VersionedFileChange {
	return result.filteredDiff
}

// ReplacedFolders returns folder identities scheduled for deletion, excluding
// any whose UID is being actively written to another path in the same diff.
func (result *rebuiltIncrementalDiffTracker) ReplacedFolders() []replacedFolder {
	if len(result.activeUIDs) == 0 {
		return result.replaced
	}
	filtered := make([]replacedFolder, 0, len(result.replaced))
	for _, r := range result.replaced {
		if _, active := result.activeUIDs[r.OldUID]; !active {
			filtered = append(filtered, r)
		}
	}
	return filtered
}
