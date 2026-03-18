package sync

import (
	"strings"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// NewCanUseIncrementalSyncFn returns a function that checks whether an
// incremental sync is safe given a list of deleted file paths.
// The returned function captures folderMetadataEnabled so callers don't
// need to thread the feature flag themselves.
func NewCanUseIncrementalSyncFn(folderMetadataEnabled bool) func([]string) bool {
	return func(deletedPaths []string) bool {
		return CanUseIncrementalSync(deletedPaths, folderMetadataEnabled)
	}
}

// CanUseIncrementalSync checks if an incremental sync can be performed or if a full sync is needed,
// given a list of deleted file paths. It returns false (full sync needed) when a folder-metadata
// file (.keep, or _folder.json when folderMetadataEnabled) is the only deletion inside its
// directory. In that scenario the folder itself may have been removed from git, but the
// metadata file is not a Grafana resource, so incremental sync cannot resolve the folder UID
// to delete it. A full sync will clean that up.
func CanUseIncrementalSync(deletedPaths []string, folderMetadataEnabled bool) bool {
	dirsWithMetadataDeletes := make(map[string]struct{})
	dirsWithOtherDeletes := make(map[string]struct{})

	for _, path := range deletedPaths {
		dir := safepath.Dir(path)
		if isFolderMetadataFile(path, folderMetadataEnabled) {
			dirsWithMetadataDeletes[dir] = struct{}{}
		} else {
			dirsWithOtherDeletes[dir] = struct{}{}
		}
	}

	for dir := range dirsWithMetadataDeletes {
		if _, exists := dirsWithOtherDeletes[dir]; !exists {
			return false
		}
	}

	return true
}

func isFolderMetadataFile(path string, folderMetadataEnabled bool) bool {
	if strings.HasSuffix(path, ".keep") {
		return true
	}
	return folderMetadataEnabled && safepath.Base(path) == "_folder.json"
}
