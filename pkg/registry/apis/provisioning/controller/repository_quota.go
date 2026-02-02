package controller

import (
	"context"

	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"k8s.io/apimachinery/pkg/labels"
)

// RepositoryQuotaChecker checks if a namespace exceeds its repository quota limits.
type RepositoryQuotaChecker struct {
	quotaGetter quotas.QuotaGetter
	repoLister  listers.RepositoryLister
}

// NewRepositoryQuotaChecker creates a new RepositoryQuotaChecker.
func NewRepositoryQuotaChecker(
	quotaGetter quotas.QuotaGetter,
	repoLister listers.RepositoryLister,
) *RepositoryQuotaChecker {
	return &RepositoryQuotaChecker{
		quotaGetter: quotaGetter,
		repoLister:  repoLister,
	}
}

// NamespaceOverQuota checks if a namespace has more repositories than allowed by its quota.
// It returns true if the namespace exceeds its repository quota, false otherwise.
// Repositories with DeletionTimestamp set are excluded from the count as they are being deleted.
func (c *RepositoryQuotaChecker) NamespaceOverQuota(
	ctx context.Context,
	namespace string,
) (bool, error) {
	// Get quota limits for this namespace/tier
	quotaStatus := c.quotaGetter.GetQuotaStatus(ctx, namespace)
	maxRepos := quotaStatus.MaxRepositories

	// If maxRepos is 0, it means unlimited quota
	if maxRepos == 0 {
		return false, nil
	}

	// List all repositories from informer cache
	repos, err := c.repoLister.Repositories(namespace).List(labels.Everything())
	if err != nil {
		return false, err
	}

	// Count only non-deleted repositories
	activeCount := 0
	for _, repo := range repos {
		if repo.DeletionTimestamp == nil {
			activeCount++
		}
	}

	// Check if count exceeds quota
	return activeCount > int(maxRepos), nil
}
