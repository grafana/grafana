package controller

import (
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// BuildConditionPatchOpsFromExisting creates condition patch operations for Repository or Connection resources.
// Accepts one or more conditions. Returns nil if none of the conditions have changed to avoid unnecessary patches.
func BuildConditionPatchOpsFromExisting(existingConditions []metav1.Condition, generation int64, newConditions ...metav1.Condition) []map[string]interface{} {
	anyChanged := false
	for _, newCondition := range newConditions {
		existing := meta.FindStatusCondition(existingConditions, newCondition.Type)
		if existing == nil ||
			existing.Status != newCondition.Status ||
			existing.Reason != newCondition.Reason ||
			existing.Message != newCondition.Message ||
			existing.ObservedGeneration != generation {
			anyChanged = true
			break
		}
	}

	if !anyChanged {
		return nil
	}

	// Clone the conditions to avoid mutating the original
	conditions := make([]metav1.Condition, len(existingConditions))
	copy(conditions, existingConditions)

	// Use meta.SetStatusCondition to handle LastTransitionTime correctly
	for _, newCondition := range newConditions {
		// Ensure ObservedGeneration is set
		newCondition.ObservedGeneration = generation
		meta.SetStatusCondition(&conditions, newCondition)
	}

	// Return patch operation to replace the entire conditions array
	return []map[string]interface{}{
		{
			"op":    "replace",
			"path":  "/status/conditions",
			"value": conditions,
		},
	}
}

// buildReadyConditionWithReason creates a Ready condition with a specific reason.
// This allows for granular error classification (InvalidSpec, AuthenticationFailed, ServiceUnavailable, RateLimited).
func buildReadyConditionWithReason(healthStatus provisioning.HealthStatus, reason string) metav1.Condition {
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
		Reason:  reason,
		Message: message,
	}
}
