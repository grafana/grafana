package controller

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

const noPathConflictMsg = "no other repository shares this URL, branch, and path"

// RepositoryPathConflictChecker checks whether a repository's URL/branch/path overlaps with
// another repository in the same namespace.
//
// This surfaces as a warning during reconciliation - it never blocks repository creation or
// update. Two repositories with overlapping paths can coexist; the resource-level
// ManagerProperties identity check (see pkg/storage/unified/apistore/managed.go) stops them
// from actually overwriting each other's synced resources, so a repository-level admission
// block is unnecessary. See repository.PathConflict's doc comment for the full reasoning.
type RepositoryPathConflictChecker struct {
	repos informer.RepositoryGetter
}

// NewRepositoryPathConflictChecker creates a new RepositoryPathConflictChecker.
func NewRepositoryPathConflictChecker(repos informer.RepositoryGetter) *RepositoryPathConflictChecker {
	return &RepositoryPathConflictChecker{
		repos: repos,
	}
}

// RepositoryPathConflictCondition checks whether cfg's URL/branch/path overlaps with any other
// repository in the namespace. It returns the condition based on the check result.
func (c *RepositoryPathConflictChecker) RepositoryPathConflictCondition(
	ctx context.Context,
	cfg *provisioning.Repository,
) (metav1.Condition, error) {
	all, err := c.repos.List(ctx, cfg.Namespace)
	if err != nil {
		return metav1.Condition{}, err
	}

	for _, v := range all {
		if conflictErr, isConflict := repository.PathConflict(cfg, v); isConflict {
			return metav1.Condition{
				Type:    provisioning.ConditionTypePathConflict,
				Status:  metav1.ConditionFalse,
				Reason:  provisioning.ReasonPathConflict,
				Message: fmt.Sprintf("%s: %s", conflictErr.Error(), v.Name),
			}, nil
		}
	}

	return metav1.Condition{
		Type:    provisioning.ConditionTypePathConflict,
		Status:  metav1.ConditionTrue,
		Reason:  provisioning.ReasonNoPathConflict,
		Message: noPathConflictMsg,
	}, nil
}
