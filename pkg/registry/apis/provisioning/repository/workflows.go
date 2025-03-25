package repository

import (
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

func IsWriteAllowed(repo *provisioning.Repository, ref string) error {
	if len(repo.Spec.Workflows) == 0 {
		return apierrors.NewBadRequest("this repository is read only")
	}

	if ref == "" {
		for _, v := range repo.Spec.Workflows {
			if v == provisioning.WriteWorkflow {
				return nil // found
			}
		}
		return apierrors.NewBadRequest("this repository does not support the write workflow")
	}

	// Only github
	if repo.Spec.Type != provisioning.GitHubRepositoryType {
		return &apierrors.StatusError{ErrStatus: v1.Status{
			Code:    http.StatusPreconditionFailed,
			Message: "Only github supports writing to a branch",
		}}
	}

	for _, v := range repo.Spec.Workflows {
		if v == provisioning.BranchWorkflow {
			return nil
		}
	}
	return apierrors.NewBadRequest("this repository does not support the branch workflow")
}
