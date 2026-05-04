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

// IncrementalSyncPolicy holds config-level settings for the incremental-vs-full sync decision.
// Initialised once at startup and shared by both the controller and webhook paths.
type IncrementalSyncPolicy struct {
	folderMetadataEnabled bool
	maxIncrementalChanges int
}

func NewIncrementalSyncPolicy(folderMetadataEnabled bool, maxIncrementalChanges int) IncrementalSyncPolicy {
	return IncrementalSyncPolicy{
		folderMetadataEnabled: folderMetadataEnabled,
		maxIncrementalChanges: maxIncrementalChanges,
	}
}

// CanUseIncrementalSync determines if an incremental sync is permitted, based on the given deleted paths
// and total change count. It returns false to require a full sync if:
//   - The total number of changes exceeds maxIncrementalChanges (when maxIncrementalChanges > 0),
//   - Any directory only has its folder-metadata file removed (.keep, or _folder.json if folderMetadataEnabled) without
//     any Grafana resources in that directory being deleted. In such cases, a full sync is needed because the incremental
//     sync cannot determine whether an entire folder (not just its metadata) was deleted, and these metadata files do not
//     represent Grafana resources themselves. Returning false ensures deleted directories are properly cleaned up by a full sync.
func (p IncrementalSyncPolicy) CanUseIncrementalSync(deletedPaths []string, totalChanges int) bool {
	if p.maxIncrementalChanges > 0 && totalChanges > p.maxIncrementalChanges {
		return false
	}

	dirsWithMetadataDeletes := make(map[string]struct{})
	dirsWithOtherDeletes := make(map[string]struct{})

	for _, path := range deletedPaths {
		dir := safepath.Dir(path)
		if isFolderMetadataFile(path, p.folderMetadataEnabled) {
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
