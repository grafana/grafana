package quotas

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

type Usage struct {
	TotalResources int64
}

func NewQuotaUsageFromStats(stats []provisioning.ResourceCount) Usage {
	return Usage{
		TotalResources: calculateTotalResources(stats),
	}
}

// EvaluateCondition creates a Quota condition based on current stats and quota status.
// Returns True if all quotas pass (or no limits configured), False if any quota is reached/exceeded.
func EvaluateCondition(quota provisioning.QuotaStatus, quotaUsage Usage) metav1.Condition {
	// Check if any limits are configured
	if quota.MaxResourcesPerRepository == 0 {
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonQuotaUnlimited,
			Message: "No quota limits configured",
		}
	}

	total := quotaUsage.TotalResources

	switch {
	case total > quota.MaxResourcesPerRepository:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionFalse,
			Reason:  provisioning.ReasonResourceQuotaExceeded,
			Message: fmt.Sprintf("Resource quota exceeded: %d/%d resources", total, quota.MaxResourcesPerRepository),
		}
	case total == quota.MaxResourcesPerRepository:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionFalse,
			Reason:  provisioning.ReasonResourceQuotaReached,
			Message: fmt.Sprintf("Resource quota reached: %d/%d resources", total, quota.MaxResourcesPerRepository),
		}
	default:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonWithinQuota,
			Message: fmt.Sprintf("Within quota: %d/%d resources", total, quota.MaxResourcesPerRepository),
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

// QuotaLimitsProvider provides quota limits for a given namespace.
// This interface allows enterprise implementations to provide namespace-specific limits
// (e.g., different limits for free tier vs paying tier).
type QuotaLimitsProvider interface {
	// GetQuotaStatus returns the quota status for the given namespace.
	// This returns the API type (QuotaStatus) that can be used both for
	// status reporting and enforcement logic.
	GetQuotaStatus(ctx context.Context, namespace string) (provisioning.QuotaStatus, error)
}

// FixedQuotaLimitsProvider is a QuotaLimitsProvider implementation that returns
// fixed quota limits regardless of namespace. This is used for OSS where all
// namespaces share the same global limits.
type FixedQuotaLimitsProvider struct {
	status provisioning.QuotaStatus
}

// NewFixedQuotaLimitsProvider creates a new FixedQuotaLimitsProvider with the given status.
func NewFixedQuotaLimitsProvider(status provisioning.QuotaStatus) *FixedQuotaLimitsProvider {
	return &FixedQuotaLimitsProvider{
		status: status,
	}
}

// GetQuotaStatus returns the fixed quota status for any namespace.
func (p *FixedQuotaLimitsProvider) GetQuotaStatus(ctx context.Context, namespace string) (provisioning.QuotaStatus, error) {
	return p.status, nil
}
