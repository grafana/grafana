package controller

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

const (
	withinQuotaMsg            = "within quota"
	namespaceQuotaReachedMsg  = "namespace quota reached"
	namespaceQuotaExceededMsg = "namespace quota exceeded"
)

// RepositoryQuotaChecker checks if a namespace exceeds its repository quota limits.
type RepositoryQuotaChecker struct {
	repos informer.RepositoryGetter
}

// NewRepositoryQuotaChecker creates a new RepositoryQuotaChecker.
func NewRepositoryQuotaChecker(
	repos informer.RepositoryGetter,
) *RepositoryQuotaChecker {
	return &RepositoryQuotaChecker{
		repos: repos,
	}
}

// RepositoryQuotaConditions checks if a namespace has more repositories than allowed by its quota.
// It returns the conditions based on the check result.
func (c *RepositoryQuotaChecker) RepositoryQuotaConditions(
	ctx context.Context,
	namespace string,
	quotaStatus provisioning.QuotaStatus,
) (metav1.Condition, error) {
	// Get quota limits for this namespace/tier
	maxRepos := quotaStatus.MaxRepositories

	// If maxRepos is 0, it means unlimited quota
	if maxRepos == 0 {
		return metav1.Condition{
			Type:    provisioning.ConditionTypeNamespaceQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonQuotaUnlimited,
			Message: "No quota limits configured",
		}, nil
	}

	// List all repositories from the read seam. The count tolerates staleness.
	repos, err := c.repos.List(ctx, namespace)
	if err != nil {
		return metav1.Condition{}, err
	}

	// Count only non-deleted repositories
	activeCount := 0
	for _, repo := range repos {
		if repo.DeletionTimestamp == nil {
			activeCount++
		}
	}

	switch {
	case activeCount == int(maxRepos):
		return metav1.Condition{
			Type:    provisioning.ConditionTypeNamespaceQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonQuotaReached,
			Message: fmt.Sprintf("%s: %d/%d repositories", namespaceQuotaReachedMsg, activeCount, maxRepos),
		}, nil
	case activeCount > int(maxRepos):
		return metav1.Condition{
			Type:    provisioning.ConditionTypeNamespaceQuota,
			Status:  metav1.ConditionFalse,
			Reason:  provisioning.ReasonQuotaExceeded,
			Message: fmt.Sprintf("%s: %d/%d repositories", namespaceQuotaExceededMsg, activeCount, maxRepos),
		}, nil
	default:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeNamespaceQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonWithinQuota,
			Message: fmt.Sprintf("%s: %d/%d repositories", withinQuotaMsg, activeCount, maxRepos),
		}, nil
	}
}
