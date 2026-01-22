package controller

import (
	"fmt"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// updateReadyCondition sets the Ready condition based on validation, secrets, health, and sync status
func (rc *RepositoryController) updateReadyCondition(
	obj *provisioning.Repository,
	validationErrors []provisioning.ErrorDetails,
	healthStatus provisioning.HealthStatus,
) []map[string]interface{} {
	// Collect all failing conditions for enhanced messaging
	var failingConditions []string

	if len(validationErrors) > 0 {
		failingConditions = append(failingConditions, "Validated=False")
	}
	// Note: Secrets and quota checks will be added later
	if !healthStatus.Healthy {
		failingConditions = append(failingConditions, "Healthy=False")
	}
	if obj.Spec.Sync.Enabled && obj.Status.Sync.State == provisioning.JobStateError {
		failingConditions = append(failingConditions, "Synced=False")
	}

	var condition metav1.Condition

	// Priority order for determining Ready status
	switch {
	case len(validationErrors) > 0:
		message := fmt.Sprintf("%d validation error(s)", len(validationErrors))
		if len(failingConditions) > 1 {
			message += fmt.Sprintf(" (also: %s)", strings.Join(failingConditions[1:], ", "))
		}
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeReady,
			Status:             metav1.ConditionFalse,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonValidationFailed,
			Message:            message,
		}

	case !healthStatus.Healthy:
		message := strings.Join(healthStatus.Message, "; ")
		if len(failingConditions) > 1 {
			message += fmt.Sprintf(" (also: %s)", strings.Join(failingConditions[1:], ", "))
		}
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeReady,
			Status:             metav1.ConditionFalse,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonHealthCheckFailed,
			Message:            message,
		}

	case obj.Spec.Sync.Enabled && obj.Status.Sync.State == provisioning.JobStateError:
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeReady,
			Status:             metav1.ConditionFalse,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonSyncFailed,
			Message:            strings.Join(obj.Status.Sync.Message, "; "),
		}

	case healthStatus.Healthy && (!obj.Spec.Sync.Enabled || obj.Status.Sync.State == provisioning.JobStateSuccess):
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeReady,
			Status:             metav1.ConditionTrue,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonRepositoryReady,
			Message:            "Repository is healthy and synced",
		}

	default:
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeReady,
			Status:             metav1.ConditionUnknown,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonReconciling,
			Message:            "Repository reconciliation in progress",
		}
	}

	return buildConditionPatchOps(obj, condition)
}

// updateHealthyCondition sets the Healthy condition based on health check results
func (rc *RepositoryController) updateHealthyCondition(
	obj *provisioning.Repository,
	healthStatus provisioning.HealthStatus,
) []map[string]interface{} {
	var condition metav1.Condition

	if healthStatus.Healthy {
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeHealthy,
			Status:             metav1.ConditionTrue,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonHealthCheckPassed,
			Message:            "Health check passed successfully",
		}
	} else {
		reason := provisioning.ReasonHealthCheckFailed
		if healthStatus.Error == provisioning.HealthFailureHook {
			reason = provisioning.ReasonHookFailed
		}

		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeHealthy,
			Status:             metav1.ConditionFalse,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             reason,
			Message:            strings.Join(healthStatus.Message, "; "),
		}
	}

	return buildConditionPatchOps(obj, condition)
}

// updateSyncedCondition sets the Synced condition based on sync status
func (rc *RepositoryController) updateSyncedCondition(
	obj *provisioning.Repository,
) []map[string]interface{} {
	var condition metav1.Condition

	if !obj.Spec.Sync.Enabled {
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeSynced,
			Status:             metav1.ConditionTrue,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonSyncDisabled,
			Message:            "Sync is disabled for this repository",
		}
	} else {
		switch obj.Status.Sync.State {
		case provisioning.JobStateSuccess:
			condition = metav1.Condition{
				Type:               provisioning.ConditionTypeSynced,
				Status:             metav1.ConditionTrue,
				ObservedGeneration: obj.Generation,
				LastTransitionTime: metav1.NewTime(time.Now()),
				Reason:             provisioning.ReasonSyncSucceeded,
				Message:            "Last sync completed successfully",
			}

		case provisioning.JobStateError:
			condition = metav1.Condition{
				Type:               provisioning.ConditionTypeSynced,
				Status:             metav1.ConditionFalse,
				ObservedGeneration: obj.Generation,
				LastTransitionTime: metav1.NewTime(time.Now()),
				Reason:             provisioning.ReasonSyncFailed,
				Message:            strings.Join(obj.Status.Sync.Message, "; "),
			}

		case provisioning.JobStateWorking:
			condition = metav1.Condition{
				Type:               provisioning.ConditionTypeSynced,
				Status:             metav1.ConditionUnknown,
				ObservedGeneration: obj.Generation,
				LastTransitionTime: metav1.NewTime(time.Now()),
				Reason:             provisioning.ReasonSyncInProgress,
				Message:            fmt.Sprintf("Sync job %s is running", obj.Status.Sync.JobID),
			}

		case provisioning.JobStatePending:
			condition = metav1.Condition{
				Type:               provisioning.ConditionTypeSynced,
				Status:             metav1.ConditionUnknown,
				ObservedGeneration: obj.Generation,
				LastTransitionTime: metav1.NewTime(time.Now()),
				Reason:             provisioning.ReasonSyncPending,
				Message:            "Sync job is queued",
			}

		default:
			// Unknown state
			condition = metav1.Condition{
				Type:               provisioning.ConditionTypeSynced,
				Status:             metav1.ConditionUnknown,
				ObservedGeneration: obj.Generation,
				LastTransitionTime: metav1.NewTime(time.Now()),
				Reason:             provisioning.ReasonReconciling,
				Message:            "Sync status unknown",
			}
		}
	}

	return buildConditionPatchOps(obj, condition)
}

// updateValidatedCondition sets the Validated condition based on validation errors
func (rc *RepositoryController) updateValidatedCondition(
	obj *provisioning.Repository,
	validationErrors []provisioning.ErrorDetails,
) []map[string]interface{} {
	var condition metav1.Condition

	if len(validationErrors) == 0 {
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeValidated,
			Status:             metav1.ConditionTrue,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonValidationSucceeded,
			Message:            "All fields validated successfully",
		}
	} else {
		// Collect field paths for summary
		fields := make([]string, 0, len(validationErrors))
		for _, err := range validationErrors {
			if err.Field != "" {
				fields = append(fields, err.Field)
			}
		}

		message := fmt.Sprintf("Validation failed for %d field(s)", len(validationErrors))
		if len(fields) > 0 {
			message += fmt.Sprintf(": %s", strings.Join(fields, ", "))
		}

		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeValidated,
			Status:             metav1.ConditionFalse,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonFieldValidationFailed,
			Message:            message,
		}
	}

	return buildConditionPatchOps(obj, condition)
}

// buildConditionPatchOps creates patch operations to update conditions using meta.SetStatusCondition logic
// This ensures LastTransitionTime is only updated when the condition actually changes
func buildConditionPatchOps(obj *provisioning.Repository, newCondition metav1.Condition) []map[string]interface{} {
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
