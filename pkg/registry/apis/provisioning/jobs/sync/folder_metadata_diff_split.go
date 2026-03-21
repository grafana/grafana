package sync

import (
	"slices"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// folderMetadataDiffSplit separates raw diff entries into folder-metadata
// changes and all the remaining changes while tracking the paths already
// claimed by the real diff.
type folderMetadataDiffSplit struct {
	otherChanges        []repository.VersionedFileChange
	metadataChanges     []repository.VersionedFileChange
	changedPaths        map[string]struct{}
	metadataFolderPaths map[string]struct{}
}

// newFolderMetadataDiffSplit partitions the raw incremental diff into metadata
// changes and other changes, then sorts the metadata side deepest-first so
// nested folder metadata is expanded deterministically.
func newFolderMetadataDiffSplit(repoDiff []repository.VersionedFileChange) folderMetadataDiffSplit {
	input := folderMetadataDiffSplit{
		otherChanges:        make([]repository.VersionedFileChange, 0, len(repoDiff)),
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

		input.otherChanges = append(input.otherChanges, change)
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

// HasMetadataChanges reports whether the diff contains any handled
// `_folder.json` create, update, or delete entries.
func (input folderMetadataDiffSplit) HasMetadataChanges() bool {
	return len(input.metadataChanges) > 0
}

// OtherChanges returns a defensive copy of the passthrough diff entries so the
// caller can append or reorder them without mutating the split state.
func (input folderMetadataDiffSplit) OtherChanges() []repository.VersionedFileChange {
	return slices.Clone(input.otherChanges)
}

// MetadataChanges returns the handled metadata changes in deepest-first order
// so nested folders are expanded deterministically.
func (input folderMetadataDiffSplit) MetadataChanges() []repository.VersionedFileChange {
	return slices.Clone(input.metadataChanges)
}

// HasRealChangeAt reports whether the original git diff already contains a
// non-metadata change for the provided path, including rename previous paths.
func (input folderMetadataDiffSplit) HasRealChangeAt(path string) bool {
	_, ok := input.changedPaths[path]
	return ok
}

// HasMetadataFolderAt reports whether another handled metadata change already
// owns the provided folder path.
func (input folderMetadataDiffSplit) HasMetadataFolderAt(path string) bool {
	_, ok := input.metadataFolderPaths[path]
	return ok
}
