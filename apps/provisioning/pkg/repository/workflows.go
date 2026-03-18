package repository

import (
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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