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
const maxConflictNamesInMessage = 10

// RepositoryPathConflictChecker checks whether a repository's URL/branch/path overlaps with
// another repository in the same namespace.
//
// This is a warning during reconciliation. Two repositories with overlapping paths can coexist; the resource-level
// ManagerProperties identity check (see pkg/storage/unified/apistore/managed.go) stops them
// from actually overwriting each other's synced resources, so a repository-level admission
// block is unnecessary.
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
// repository in the stack.
func (c *RepositoryPathConflictChecker) RepositoryPathConflictCondition(
	ctx context.Context,
	cfg *provisioning.Repository,
) (metav1.Condition, error) {
	all, err := c.repos.List(ctx, cfg.Namespace)
	if err != nil {
		return metav1.Condition{}, err
	}

	// cfg can conflict with more than one repository at once (e.g. an exact duplicate and
	// one or more ancestor/descendant paths). Report and sort all errors for a deterministic error message
	var duplicates, overlaps []string
	for _, v := range all {
		conflictErr, isConflict := repository.PathConflict(cfg, v)
		if !isConflict {
			continue
		}
		switch {
		case errors.Is(conflictErr, repository.ErrRepositoryDuplicatePath):
			duplicates = append(duplicates, v.Name)
		case errors.Is(conflictErr, repository.ErrRepositoryParentFolderConflict):
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
	joinConflictNames := func(names []string) string {
		if len(names) <= maxConflictNamesInMessage {
			return strings.Join(names, ", ")
		}
		return fmt.Sprintf("%s (and %d more)", strings.Join(names[:maxConflictNamesInMessage], ", "), len(names)-maxConflictNamesInMessage)
	}

	if len(duplicates) > 0 {
		parts = append(parts, fmt.Sprintf("%s: %s", repository.ErrRepositoryDuplicatePath.Error(), joinConflictNames(duplicates)))
	}
	if len(overlaps) > 0 {
		parts = append(parts, fmt.Sprintf("%s: %s", repository.ErrRepositoryParentFolderConflict.Error(), joinConflictNames(overlaps)))
	}

	return metav1.Condition{
		Type:    provisioning.ConditionTypePathConflict,
		Status:  metav1.ConditionFalse,
		Reason:  provisioning.ReasonPathConflict,
		Message: strings.Join(parts, "; "),
	}, nil
}
