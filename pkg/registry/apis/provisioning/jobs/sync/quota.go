package sync

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"go.opentelemetry.io/otel/attribute"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// checkQuotaBeforeSync checks if the repository is over quota and if the sync would exceed the quota limit.
// It validates the net change against the quota limit.
// netChange represents the net change in resource count (positive for additions, negative for deletions).
func checkQuotaBeforeSync(ctx context.Context, repo repository.Repository, netChange int64, repositoryResources resources.RepositoryResources, tracer tracing.Tracer) error {
	cfg := repo.Config()
	status := cfg.Status

	// Check if there's a ResourceQuota condition indicating quota exceeded
	var resourceQuotaCondition *metav1.Condition
	for i := range status.Conditions {
		if status.Conditions[i].Type == provisioning.ConditionTypeResourceQuota {
			resourceQuotaCondition = &status.Conditions[i]
			break
		}
	}

	// If no resource quota condition exists or quota is not exceeded, proceed
	if resourceQuotaCondition == nil {
		return nil
	}

	// Check if quota is exceeded (status is False and reason is QuotaExceeded)
	isOverQuota := resourceQuotaCondition.Status == metav1.ConditionFalse &&
		resourceQuotaCondition.Reason == provisioning.ReasonQuotaExceeded

	if !isOverQuota {
		return nil
	}

	// Get the quota limit
	quotaLimit := status.Quota.MaxResourcesPerRepository
	if quotaLimit == 0 {
		// Unlimited quota, proceed
		return nil
	}

	// Get current resource count from the repository
	stats, err := repositoryResources.Stats(ctx)
	if err != nil {
		return fmt.Errorf("failed to get repository stats: %w", err)
	}

	// Calculate current total resource count by summing all ResourceCount.Count values
	// from all managers in stats.Managed, excluding folders
	var currentCount int64
	for _, manager := range stats.Managed {
		for _, resourceCount := range manager.Stats {
			// Exclude folders from quota count, as the limit is worded per dashboard, not including folders.
			if resourceCount.Group == "folder.grafana.app" {
				continue
			}
			currentCount += resourceCount.Count
		}
	}

	// Check if the final count would exceed the quota limit
	finalCount := currentCount + netChange
	if finalCount > quotaLimit {
		_, checkSpan := tracer.Start(ctx, "provisioning.sync.check_quota")
		checkSpan.SetAttributes(
			attribute.Int64("quota_limit", quotaLimit),
			attribute.Int64("current_count", currentCount),
			attribute.Int64("net_change", netChange),
			attribute.Int64("final_count", finalCount),
		)
		checkSpan.End()

		return fmt.Errorf("repository is over quota (current: %d resources) and sync would add %d resources, resulting in %d resources exceeding the quota limit of %d. sync cannot proceed", currentCount, netChange, finalCount, quotaLimit)
	}

	return nil
}
