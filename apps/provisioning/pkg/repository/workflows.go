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
