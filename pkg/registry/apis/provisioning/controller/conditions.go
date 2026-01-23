package controller

import (
	"fmt"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// QuotaLimits holds all configured quota limits for a repository.
// This struct is designed to be extensible for future quota types.
type QuotaLimits struct {
	// MaxResources is the maximum number of resources allowed per repository.
	// A value of 0 means unlimited.
	MaxResources int64
	// Future: MaxStorageBytes int64
	// Future: MaxAPIRequests int64
}

// BuildConditionPatchOpsFromExisting creates condition patch operations for Repository or Connection resources.
// Returns nil if the condition hasn't changed to avoid unnecessary patches.
func BuildConditionPatchOpsFromExisting(existingConditions []metav1.Condition, generation int64, newCondition metav1.Condition) []map[string]interface{} {
	// Check if condition already exists and is unchanged
	existingCondition := meta.FindStatusCondition(existingConditions, newCondition.Type)
	if existingCondition != nil &&
		existingCondition.Status == newCondition.Status &&
		existingCondition.Reason == newCondition.Reason &&
		existingCondition.Message == newCondition.Message &&
		existingCondition.ObservedGeneration == generation {
		// Condition hasn't changed, no need to patch
		return nil
	}

	// Clone the conditions to avoid mutating the original
	conditions := make([]metav1.Condition, len(existingConditions))
	copy(conditions, existingConditions)

	// Ensure ObservedGeneration is set
	newCondition.ObservedGeneration = generation

	// Use meta.SetStatusCondition to handle LastTransitionTime correctly
	meta.SetStatusCondition(&conditions, newCondition)

	// Return patch operation to replace the entire conditions array
	return []map[string]interface{}{
		{
			"op":    "replace",
			"path":  "/status/conditions",
			"value": conditions,
		},
	}
}

// buildReadyConditionFromHealth creates a Ready condition based on health status.
func buildReadyConditionFromHealth(healthStatus provisioning.HealthStatus) metav1.Condition {
	if healthStatus.Healthy {
		return metav1.Condition{
			Type:    provisioning.ConditionTypeReady,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonAvailable,
			Message: "Resource is available",
		}
	}

	// Build message from health status messages
	message := "Resource is unavailable"
	if len(healthStatus.Message) > 0 {
		message = healthStatus.Message[0]
	}

	return metav1.Condition{
		Type:    provisioning.ConditionTypeReady,
		Status:  metav1.ConditionFalse,
		Reason:  provisioning.ReasonUnavailable,
		Message: message,
	}
}

// BuildQuotaCondition creates a Quota condition based on current stats and limits.
// Returns True if all quotas pass (or no limits configured), False if any quota is reached/exceeded.
func BuildQuotaCondition(stats []provisioning.ResourceCount, limits QuotaLimits) metav1.Condition {
	// Check if any limits are configured
	if limits.MaxResources == 0 {
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonQuotaUnlimited,
			Message: "No quota limits configured",
		}
	}

	total := calculateTotalResources(stats)

	switch {
	case total > limits.MaxResources:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionFalse,
			Reason:  provisioning.ReasonResourceQuotaExceeded,
			Message: fmt.Sprintf("Resource quota exceeded: %d/%d resources", total, limits.MaxResources),
		}
	case total == limits.MaxResources:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionFalse,
			Reason:  provisioning.ReasonResourceQuotaReached,
			Message: fmt.Sprintf("Resource quota reached: %d/%d resources", total, limits.MaxResources),
		}
	default:
		return metav1.Condition{
			Type:    provisioning.ConditionTypeQuota,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonWithinQuota,
			Message: fmt.Sprintf("Within quota: %d/%d resources", total, limits.MaxResources),
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
