package controller

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

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

	// cfg can conflict with more than one repository at once (e.g. an exact duplicate and
	// one or more ancestor/descendant paths). Report all of them rather than the first one
	// found - all is informer-ordered, not sorted, so a single "first match" would make the
	// reported conflict depend on iteration order. Group by conflict kind and sort names
	// within each group so the message is deterministic regardless of that order.
	var duplicates, overlaps []string
	for _, v := range all {
		conflictErr, isConflict := repository.PathConflict(cfg, v)
		if !isConflict {
			continue
		}
		if errors.Is(conflictErr, repository.ErrRepositoryDuplicatePath) {
			duplicates = append(duplicates, v.Name)
		} else {
			overlaps = append(overlaps, v.Name)
		}
	}

	if len(duplicates) == 0 && len(overlaps) == 0 {
		return metav1.Condition{
			Type:    provisioning.ConditionTypePathConflict,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonNoPathConflict,
			Message: noPathConflictMsg,
		}, nil
	}

	slices.Sort(duplicates)
	slices.Sort(overlaps)

	var parts []string
	if len(duplicates) > 0 {
		parts = append(parts, fmt.Sprintf("%s: %s", repository.ErrRepositoryDuplicatePath.Error(), strings.Join(duplicates, ", ")))
	}
	if len(overlaps) > 0 {
		parts = append(parts, fmt.Sprintf("%s: %s", repository.ErrRepositoryParentFolderConflict.Error(), strings.Join(overlaps, ", ")))
	}

	return metav1.Condition{
		Type:    provisioning.ConditionTypePathConflict,
		Status:  metav1.ConditionFalse,
		Reason:  provisioning.ReasonPathConflict,
		Message: strings.Join(parts, "; "),
	}, nil
}
