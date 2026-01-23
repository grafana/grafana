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
	// HACK: NewHackyQuota converts -1 → 0 (unlimited), 0 → 10 (default), N → N
	MaxRepositories int64
}

// NewHackyQuota creates a QuotaLimits struct with HACK logic for repository limits.
// HACK: This function handles the conversion of config values to internal representation:
// - 0 → 10 (default, when config value is 0 but config defaults to 10)
// - N (where N > 0) → N (use value as-is)
// - Validator: 0 = unlimited, > 0 = use value
// This is a workaround to handle default values.
// This HACK should be removed once we can coordinate changes across repositories.
func NewHackyQuota(maxResourcesPerRepository, maxRepositories int64) QuotaLimits {
	maxRepos := maxRepositories
	// HACK: Config defaults to 10 in pkg/setting. If the value is 0, it means user explicitly set unlimited.
	// However, if the value is 0 and it's the default (not explicitly set), we need to convert to 10.
	// Since we can't distinguish, we treat 0 as unlimited (user explicitly set to 0).
	// The default of 10 is handled in pkg/setting when reading the config.
	// For now, we pass through 0 as-is (unlimited) and N as-is.
	// The validator will handle 0 as unlimited.
	return QuotaLimits{
		MaxResources:    maxResourcesPerRepository,
		MaxRepositories: maxRepos,
	}
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
