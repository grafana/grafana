package controller

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

const (
	withinQuotaMsg            = "within quota"
	namespaceQuotaReachedMsg  = "namespace quota reached"
	namespaceQuotaExceededMsg = "namespace quota exceeded"
)

// RepositoryQuotaChecker checks if a namespace exceeds its repository quota limits.
type RepositoryQuotaChecker struct {
	repoLister listers.RepositoryLister
}

// NewRepositoryQuotaChecker creates a new RepositoryQuotaChecker.
func NewRepositoryQuotaChecker(
	repoLister listers.RepositoryLister,
) *RepositoryQuotaChecker {
	return &RepositoryQuotaChecker{
		repoLister: repoLister,
	}
}

// RepositoryQuotaConditions checks if a namespace has more repositories than allowed by its quota.
// It returns the conditions based on the check result.
func (c *RepositoryQuotaChecker) RepositoryQuotaConditions(
	_ context.Context,
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

	// List all repositories from informer cache
	repos, err := c.repoLister.Repositories(namespace).List(labels.Everything())
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
