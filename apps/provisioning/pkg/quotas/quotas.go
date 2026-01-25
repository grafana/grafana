package quotas

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// QuotaLimits holds all configured quota limits for a repository.
// This struct is designed to be extensible for future quota types.
type QuotaLimits struct {
	// MaxResources is the maximum number of resources allowed per repository.
	// A value of 0 means unlimited.
	MaxResources int64

	// MaxRepositories is the maximum number of repositories allowed per namespace.
	// 0 = unlimited, > 0 = use value
	MaxRepositories int64
}

// EvaluateCondition creates a Quota condition based on current stats and limits.
// Returns True if all quotas pass (or no limits configured), False if any quota is reached/exceeded.
func (q QuotaLimits) EvaluateCondition(stats []provisioning.ResourceCount) metav1.Condition {
	// Check if any limits are configured
	if q.MaxResources == 0 {
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonQuotaUnlimited,
			Message: "No quota limits configured",
		}
	}

	total := calculateTotalResources(stats)

	switch {
	case total > q.MaxResources:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionFalse,
			Reason:  provisioning.ReasonResourceQuotaExceeded,
			Message: fmt.Sprintf("Resource quota exceeded: %d/%d resources", total, q.MaxResources),
		}
	case total == q.MaxResources:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionFalse,
			Reason:  provisioning.ReasonResourceQuotaReached,
			Message: fmt.Sprintf("Resource quota reached: %d/%d resources", total, q.MaxResources),
		}
	default:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonWithinQuota,
			Message: fmt.Sprintf("Within quota: %d/%d resources", total, q.MaxResources),
		}
	}
}

// calculateTotalResources sums up all resource counts from the stats.
func calculateTotalResources(stats []provisioning.ResourceCount) int64 {
	var total int64
	for _, s := range stats {
		total += s.Count
	}
	return total
}
