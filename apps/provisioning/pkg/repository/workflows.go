package repository

import (
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

func IsWriteAllowed(repo *provisioning.Repository, ref string) error {
	if len(repo.Spec.Workflows) == 0 {
		return apierrors.NewBadRequest("this repository is read only")
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
		return apierrors.NewBadRequest("this repository does not support the write workflow")
	case ref != "" && !supportsBranch:
		return apierrors.NewBadRequest("this repository does not support the branch workflow")
	default:
		return nil
	}
}

// CanUseIncrementalSync checks if an incremental sync can be performed or if a full sync is needed,
// given a list of deleted file paths. It will return true if a .keep file is deleted without
// other files being deleted in the same directory. This is because the folder will not be a part of the
// deleted files, and the .keep file is not a resource in grafana, so we can't get the folder uid.
// A full sync will clean that up.
func CanUseIncrementalSync(deletedPaths []string) bool {
	dirsWithKeepDeletes := make(map[string]struct{})
	dirsWithOtherDeletes := make(map[string]struct{})

	for _, path := range deletedPaths {
		dir := safepath.Dir(path)
		if strings.HasSuffix(path, ".keep") {
			dirsWithKeepDeletes[dir] = struct{}{}
		} else {
			dirsWithOtherDeletes[dir] = struct{}{}
		}
	}

	// if there are any .keep files deleted that don't have other files deleted in the same folder,
	// we need to do a full sync
	for dir := range dirsWithKeepDeletes {
		if _, exists := dirsWithOtherDeletes[dir]; !exists {
			return false
		}
	}

	return true
}
