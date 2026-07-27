package controller

import (
	"fmt"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// BuildConditionPatchOpsFromExisting creates condition patch operations for Repository or Connection resources.
// Accepts one or more conditions. Returns nil if none of the conditions have changed to avoid unnecessary patches.
//
// Why per-condition ops instead of a single whole-array replace:
// Multiple actors (the RepositoryController and the sync worker) concurrently patch
// /status/conditions. A whole-array replace built from a stale view can silently
// clobber conditions the caller does not know about (for example, a controller
// reconcile running with a stale informer cache can overwrite the PullStatus the
// sync worker just wrote). Emitting per-condition ops (`add /-` for new types,
// `replace /<index>` for changed types) leaves unrelated conditions untouched.
func BuildConditionPatchOpsFromExisting(existingConditions []metav1.Condition, generation int64, newConditions ...metav1.Condition) []map[string]interface{} {
	// When the conditions array has never been initialized, a single whole-array
	// replace both creates the array and seeds it. JSON Patch `add /path/-` requires
	// the target array to already exist.
	if len(existingConditions) == 0 {
		return buildInitialConditionsPatch(generation, newConditions)
	}

	var ops []map[string]interface{}

	for _, newCondition := range newConditions {
		newCondition.ObservedGeneration = generation

		existing := meta.FindStatusCondition(existingConditions, newCondition.Type)
		if existing == nil {
			// meta.SetStatusCondition sets LastTransitionTime to now when the
			// condition is new; mirror that here so the appended condition has a
			// timestamp.
			if newCondition.LastTransitionTime.IsZero() {
				newCondition.LastTransitionTime = metav1.Now()
			}
			ops = append(ops, map[string]interface{}{
				"op":    "add",
				"path":  "/status/conditions/-",
				"value": newCondition,
			})
			continue
		}

		if existing.Status == newCondition.Status &&
			existing.Reason == newCondition.Reason &&
			existing.Message == newCondition.Message &&
			existing.ObservedGeneration == generation {
			continue
		}

		// Preserve LastTransitionTime when Status is unchanged; update it when Status flips.
		if existing.Status == newCondition.Status {
			newCondition.LastTransitionTime = existing.LastTransitionTime
		} else if newCondition.LastTransitionTime.IsZero() {
			newCondition.LastTransitionTime = metav1.Now()
		}

		index := indexOfConditionType(existingConditions, newCondition.Type)
		ops = append(ops, map[string]interface{}{
			"op":    "replace",
			"path":  fmt.Sprintf("/status/conditions/%d", index),
			"value": newCondition,
		})
	}

	if len(ops) == 0 {
		return nil
	}
	return ops
}

// buildInitialConditionsPatch is used when the conditions array is empty or nil.
// A single whole-array replace creates the array with all new conditions applied
// through meta.SetStatusCondition so LastTransitionTime is handled correctly.
func buildInitialConditionsPatch(generation int64, newConditions []metav1.Condition) []map[string]interface{} {
	if len(newConditions) == 0 {
		return nil
	}

	var conditions []metav1.Condition
	for _, newCondition := range newConditions {
		newCondition.ObservedGeneration = generation
		meta.SetStatusCondition(&conditions, newCondition)
	}

	return []map[string]interface{}{
		{
			"op":    "replace",
			"path":  "/status/conditions",
			"value": conditions,
		},
	}
}

func indexOfConditionType(conditions []metav1.Condition, conditionType string) int {
	for i, c := range conditions {
		if c.Type == conditionType {
			return i
		}
	}
	return -1
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
