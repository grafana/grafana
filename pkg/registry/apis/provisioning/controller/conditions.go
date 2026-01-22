package controller

import (
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// buildConditionPatchOps creates patch operations to update conditions using meta.SetStatusCondition logic
// This ensures LastTransitionTime is only updated when the condition actually changes
// Returns empty slice if the condition hasn't changed to avoid unnecessary patches
func buildConditionPatchOps(obj *provisioning.Repository, newCondition metav1.Condition) []map[string]interface{} {
	// Check if condition already exists and is unchanged
	existingCondition := meta.FindStatusCondition(obj.Status.Conditions, newCondition.Type)
	if existingCondition != nil &&
		existingCondition.Status == newCondition.Status &&
		existingCondition.Reason == newCondition.Reason &&
		existingCondition.Message == newCondition.Message &&
		existingCondition.ObservedGeneration == newCondition.ObservedGeneration {
		// Condition hasn't changed, no need to patch
		return nil
	}

	// Clone the conditions to avoid mutating the original
	conditions := make([]metav1.Condition, len(obj.Status.Conditions))
	copy(conditions, obj.Status.Conditions)

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

// buildConditionPatchOpsFromExisting creates condition patch operations for Repository or Connection resources.
// Returns nil if the condition hasn't changed to avoid unnecessary patches.
func buildConditionPatchOpsFromExisting(existingConditions []metav1.Condition, generation int64, newCondition metav1.Condition) []map[string]interface{} {
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
