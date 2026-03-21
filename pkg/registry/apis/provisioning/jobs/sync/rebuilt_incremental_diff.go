package sync

import "github.com/grafana/grafana/apps/provisioning/pkg/repository"

// rebuiltIncrementalDiff accumulates the rewritten diff and tracks generated
// paths so we do not emit duplicate changes while expanding metadata changes.
type rebuiltIncrementalDiff struct {
	filteredDiff   []repository.VersionedFileChange
	generatedPaths map[string]struct{}
	replaced       []replacedFolder
}

// newRebuiltIncrementalDiff seeds the rewritten diff with passthrough changes
// and prepares tracking for generated paths and replaced folders.
func newRebuiltIncrementalDiff(passthrough []repository.VersionedFileChange) *rebuiltIncrementalDiff {
	return &rebuiltIncrementalDiff{
		filteredDiff:   passthrough,
		generatedPaths: make(map[string]struct{}),
		replaced:       make([]replacedFolder, 0),
	}
}

// HasGeneratedPath reports whether the rebuilder has already emitted a
// synthetic change for the provided path.
func (result *rebuiltIncrementalDiff) HasGeneratedPath(path string) bool {
	_, ok := result.generatedPaths[path]
	return ok
}

// Append adds a synthetic change to the rewritten diff and marks its path as
// generated so later expansions do not emit duplicates.
func (result *rebuiltIncrementalDiff) Append(change repository.VersionedFileChange) {
	result.filteredDiff = append(result.filteredDiff, change)
	result.generatedPaths[change.Path] = struct{}{}
}

// AppendReplaced records an old folder identity that must be deleted after the
// rewritten diff has been applied successfully.
func (result *rebuiltIncrementalDiff) AppendReplaced(replaced replacedFolder) {
	result.replaced = append(result.replaced, replaced)
}
