package repository

import (
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

func IsWriteAllowed(repo *provisioning.Repository, ref string) error {
	if len(repo.Spec.Workflows) == 0 {
		return apierrors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), "", fmt.Errorf("write operations are not allowed for this repository"))
	}

	var supportsWrite, supportsBranch bool
	for _, v := range repo.Spec.Workflows {
		switch v {
		case provisioning.WriteWorkflow:
			supportsWrite = true
		case provisioning.BranchWorkflow:
			supportsBranch = repo.Spec.Type.IsGit()
		}
	}

	// Ref may be the configured branch for github repositories
	if ref != "" && repo.Spec.GitHub != nil && repo.Spec.GitHub.Branch == ref {
		ref = ""
	}

	// Ref may be the configured branch for git repositories
	if ref != "" && repo.Spec.Git != nil && repo.Spec.Git.Branch == ref {
		ref = ""
	}

	switch {
	case ref == "" && !supportsWrite:
		return apierrors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), "", fmt.Errorf("write operations are not allowed for this repository"))
	case ref != "" && !supportsBranch:
		return apierrors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), "", fmt.Errorf("branch workflow is not allowed for this repository"))
	default:
		return nil
	}
}

// CanUseIncrementalSyncInController determines if an incremental sync is permitted in the controller, based on the given file changes,
// the folder metadata feature flag, and the maximum allowed changes. It returns false to require a full sync if:
//   - The number of changes equals or exceeds maxIncrementalDiffSize,
//   - Any directory only has its folder-metadata file removed (.keep, or _folder.json if folderMetadataEnabled) without
//     any Grafana resources in that directory being deleted. In such cases, a full sync is needed because the incremental
//     sync cannot determine whether an entire folder (not just its metadata) was deleted, and these metadata files do not
//     represent Grafana resources themselves. Returning false ensures deleted directories are properly cleaned up by a full sync.
func CanUseIncrementalSyncInController(
	changes []VersionedFileChange,
	folderMetadataEnabled bool,
	maxIncrementalDiffSize int,
) bool {
	if maxIncrementalDiffSize > 0 && len(changes) >= maxIncrementalDiffSize {
		return false
	}

	var deletedPaths []string
	for _, change := range changes {
		if change.Action == FileActionDeleted {
			deletedPaths = append(deletedPaths, change.Path)
		}
	}

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

// CanUseIncrementalSyncInWebhook determines if an incremental sync is permitted in the webhook, based on the given deleted paths,
// and the folder metadata feature flag. It returns false to require a full sync if:
//   - Any directory only has its folder-metadata file removed (.keep, or _folder.json if folderMetadataEnabled) without
//     any Grafana resources in that directory being deleted. In such cases, a full sync is needed because the incremental
//     sync cannot determine whether an entire folder (not just its metadata) was deleted, and these metadata files do not
//     represent Grafana resources themselves. Returning false ensures deleted directories are properly cleaned up by a full sync.
func CanUseIncrementalSyncInWebhook(deletedPaths []string, folderMetadataEnabled bool) bool {
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
