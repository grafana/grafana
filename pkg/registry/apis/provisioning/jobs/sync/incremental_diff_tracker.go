package sync

import "github.com/grafana/grafana/apps/provisioning/pkg/repository"

// rebuiltIncrementalDiffTracker accumulates the rewritten diff and tracks generated
// paths so we do not emit duplicate changes while expanding metadata changes.
type rebuiltIncrementalDiffTracker struct {
	filteredDiff   []repository.VersionedFileChange
	generatedPaths map[string]struct{}
	replaced       []replacedFolder
}

// newRebuiltIncrementalDiff seeds the rewritten diff with changes
// and prepares tracking for generated paths and replaced folders.
func newRebuiltIncrementalDiffTracker(changes []repository.VersionedFileChange) *rebuiltIncrementalDiffTracker {
	return &rebuiltIncrementalDiffTracker{
		filteredDiff:   changes,
		generatedPaths: make(map[string]struct{}),
		replaced:       make([]replacedFolder, 0),
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

func (result *rebuiltIncrementalDiffTracker) IncrementalDiff() []repository.VersionedFileChange {
	return result.filteredDiff
}

func (result *rebuiltIncrementalDiffTracker) ReplacedFolders() []replacedFolder {
	return result.replaced
}
