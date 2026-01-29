package controller

import (
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

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

// buildSpecCondition creates a Spec condition based on field validation errors.
// Returns a condition with status True if there are no errors, False otherwise.
func buildSpecCondition(fieldErrors []provisioning.ErrorDetails) metav1.Condition {
	if len(fieldErrors) == 0 {
		return metav1.Condition{
			Type:    provisioning.ConditionTypeSpec,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonSpecValid,
			Message: "Spec is valid",
		}
	}

	// Build message with error count
	var message string
	if len(fieldErrors) == 1 {
		message = "Spec has 1 validation error"
	} else {
		message = "Spec has multiple validation errors"
	}

	return metav1.Condition{
		Type:    provisioning.ConditionTypeSpec,
		Status:  metav1.ConditionFalse,
		Reason:  provisioning.ReasonSpecInvalid,
		Message: message,
	}
}
