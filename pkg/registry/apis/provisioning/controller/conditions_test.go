package controller

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestBuildReadyConditionFromHealth(t *testing.T) {
	tests := []struct {
		name           string
		healthStatus   provisioning.HealthStatus
		expectedStatus metav1.ConditionStatus
		expectedReason string
		expectedMsg    string
	}{
		{
			name: "healthy status creates Ready=True condition",
			healthStatus: provisioning.HealthStatus{
				Healthy: true,
				Checked: time.Now().UnixMilli(),
			},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonAvailable,
			expectedMsg:    "Resource is available",
		},
		{
			name: "unhealthy status creates Ready=False condition",
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Checked: time.Now().UnixMilli(),
				Message: []string{"connection failed"},
			},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonInvalidSpec,
			expectedMsg:    "connection failed",
		},
		{
			name: "unhealthy with no message uses default message",
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Checked: time.Now().UnixMilli(),
			},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonInvalidSpec,
			expectedMsg:    "Resource is unavailable",
		},
		{
			name: "unhealthy with multiple messages uses first message",
			healthStatus: provisioning.HealthStatus{
				Healthy: false,
				Checked: time.Now().UnixMilli(),
				Message: []string{"first error", "second error"},
			},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonInvalidSpec,
			expectedMsg:    "first error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			condition := buildReadyConditionWithReason(tt.healthStatus, provisioning.ReasonInvalidSpec)

			assert.Equal(t, provisioning.ConditionTypeReady, condition.Type)
			assert.Equal(t, tt.expectedStatus, condition.Status)
			assert.Equal(t, tt.expectedReason, condition.Reason)
			assert.Equal(t, tt.expectedMsg, condition.Message)
		})
	}
}

func TestBuildConditionPatchOpsFromExisting(t *testing.T) {
	fixedTime := metav1.NewTime(time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC))

	tests := []struct {
		name               string
		existingConditions []metav1.Condition
		generation         int64
		newConditions      []metav1.Condition
		expectPatch        bool
		expectedConditions int
	}{
		{
			name:               "creates patch when no existing conditions",
			existingConditions: nil,
			generation:         1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeReady,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonAvailable,
					Message: "Resource is available",
				},
			},
			expectPatch:        true,
			expectedConditions: 1,
		},
		{
			name: "creates patch when condition changes",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeReady,
					Status:             metav1.ConditionFalse,
					Reason:             provisioning.ReasonInvalidSpec,
					Message:            "Resource is unavailable",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeReady,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonAvailable,
					Message: "Resource is available",
				},
			},
			expectPatch:        true,
			expectedConditions: 1,
		},
		{
			name: "no patch when condition unchanged",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeReady,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonAvailable,
					Message:            "Resource is available",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeReady,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonAvailable,
					Message: "Resource is available",
				},
			},
			expectPatch: false,
		},
		{
			name: "creates patch when generation changes",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeReady,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonAvailable,
					Message:            "Resource is available",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 2,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeReady,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonAvailable,
					Message: "Resource is available",
				},
			},
			expectPatch:        true,
			expectedConditions: 1,
		},
		{
			name: "creates patch when reason changes",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeReady,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonAvailable,
					Message:            "Resource is available",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeReady,
					Status:  metav1.ConditionTrue,
					Reason:  "DifferentReason",
					Message: "Resource is available",
				},
			},
			expectPatch:        true,
			expectedConditions: 1,
		},
		{
			name: "creates patch when message changes",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeReady,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonAvailable,
					Message:            "Resource is available",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeReady,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonAvailable,
					Message: "Different message",
				},
			},
			expectPatch:        true,
			expectedConditions: 1,
		},
		{
			name:               "multiple conditions are merged into a single patch",
			existingConditions: nil,
			generation:         1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeNamespaceQuota,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonQuotaUnlimited,
					Message: "No quota limits configured",
				},
				{
					Type:    provisioning.ConditionTypeReady,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonAvailable,
					Message: "Resource is available",
				},
			},
			expectPatch:        true,
			expectedConditions: 2,
		},
		{
			name: "only changed conditions trigger a patch",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeNamespaceQuota,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonQuotaUnlimited,
					Message:            "No quota limits configured",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeNamespaceQuota,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonQuotaUnlimited,
					Message: "No quota limits configured",
				},
				{
					Type:    provisioning.ConditionTypeReady,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonAvailable,
					Message: "Resource is available",
				},
			},
			expectPatch:        true,
			expectedConditions: 2,
		},
		{
			name: "no patch when all conditions unchanged",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeNamespaceQuota,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonQuotaUnlimited,
					Message:            "No quota limits configured",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
				{
					Type:               provisioning.ConditionTypeReady,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonAvailable,
					Message:            "Resource is available",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeNamespaceQuota,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonQuotaUnlimited,
					Message: "No quota limits configured",
				},
				{
					Type:    provisioning.ConditionTypeReady,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonAvailable,
					Message: "Resource is available",
				},
			},
			expectPatch: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			patchOps := BuildConditionPatchOpsFromExisting(tt.existingConditions, tt.generation, tt.newConditions...)

			if !tt.expectPatch {
				assert.Nil(t, patchOps, "expected no patch operations")
				return
			}

			require.NotNil(t, patchOps, "expected patch operations")

			finalConditions := applyConditionPatchOps(t, tt.existingConditions, patchOps)
			assert.Len(t, finalConditions, tt.expectedConditions)

			for _, cond := range finalConditions {
				assert.Equal(t, tt.generation, cond.ObservedGeneration)
			}
		})
	}
}

// applyConditionPatchOps simulates the apiserver applying the generated JSON
// patch ops to the existing conditions so assertions can verify the logical
// outcome regardless of whether the function emits a whole-array replace or
// per-condition ops.
func applyConditionPatchOps(t *testing.T, existing []metav1.Condition, ops []map[string]interface{}) []metav1.Condition {
	t.Helper()
	conditions := make([]metav1.Condition, len(existing))
	copy(conditions, existing)
	for _, op := range ops {
		path, _ := op["path"].(string)
		value := op["value"]
		switch op["op"] {
		case "replace":
			if path == "/status/conditions" {
				arr, ok := value.([]metav1.Condition)
				require.True(t, ok, "whole-array replace value must be []metav1.Condition")
				conditions = arr
				continue
			}
			var idx int
			_, err := fmt.Sscanf(path, "/status/conditions/%d", &idx)
			require.NoError(t, err, "unexpected replace path: %s", path)
			require.Less(t, idx, len(conditions), "replace index out of bounds")
			cond, ok := value.(metav1.Condition)
			require.True(t, ok, "replace value must be metav1.Condition")
			conditions[idx] = cond
		case "add":
			require.Equal(t, "/status/conditions/-", path, "unexpected add path: %s", path)
			cond, ok := value.(metav1.Condition)
			require.True(t, ok, "add value must be metav1.Condition")
			conditions = append(conditions, cond)
		default:
			t.Fatalf("unexpected op: %v", op["op"])
		}
	}
	return conditions
}

func TestBuildConditionPatchOpsFromExisting_MultipleConditions(t *testing.T) {
	fixedTime := metav1.NewTime(time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC))

	tests := []struct {
		name               string
		existingConditions []metav1.Condition
		generation         int64
		newConditions      []metav1.Condition
		expectPatch        bool
		expectedConditions int
	}{
		{
			name:               "creates patch when no existing conditions with multiple new ones",
			existingConditions: nil,
			generation:         1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeResourceQuota,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonWithinQuota,
					Message: "Within quota: 5/100 resources",
				},
				{
					Type:    provisioning.ConditionTypePullStatus,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonSuccess,
					Message: "Pull completed successfully",
				},
			},
			expectPatch:        true,
			expectedConditions: 2,
		},
		{
			name: "no patch when all conditions unchanged",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeResourceQuota,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonWithinQuota,
					Message:            "Within quota: 5/100 resources",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
				{
					Type:               provisioning.ConditionTypePullStatus,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonSuccess,
					Message:            "Pull completed successfully",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeResourceQuota,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonWithinQuota,
					Message: "Within quota: 5/100 resources",
				},
				{
					Type:    provisioning.ConditionTypePullStatus,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonSuccess,
					Message: "Pull completed successfully",
				},
			},
			expectPatch: false,
		},
		{
			name: "creates patch when one of multiple conditions changes",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeResourceQuota,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonWithinQuota,
					Message:            "Within quota: 5/100 resources",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
				{
					Type:               provisioning.ConditionTypePullStatus,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonSuccess,
					Message:            "Pull completed successfully",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeResourceQuota,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonWithinQuota,
					Message: "Within quota: 5/100 resources",
				},
				{
					Type:    provisioning.ConditionTypePullStatus,
					Status:  metav1.ConditionFalse,
					Reason:  provisioning.ReasonFailure,
					Message: "network error",
				},
			},
			expectPatch:        true,
			expectedConditions: 2,
		},
		{
			name: "preserves existing unrelated conditions",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeReady,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonAvailable,
					Message:            "Resource is available",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 1,
			newConditions: []metav1.Condition{
				{
					Type:    provisioning.ConditionTypeResourceQuota,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonWithinQuota,
					Message: "Within quota: 5/100 resources",
				},
				{
					Type:    provisioning.ConditionTypePullStatus,
					Status:  metav1.ConditionTrue,
					Reason:  provisioning.ReasonSuccess,
					Message: "Pull completed successfully",
				},
			},
			expectPatch:        true,
			expectedConditions: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			patchOps := BuildConditionPatchOpsFromExisting(tt.existingConditions, tt.generation, tt.newConditions...)

			if !tt.expectPatch {
				assert.Nil(t, patchOps, "expected no patch operations")
				return
			}

			require.NotNil(t, patchOps, "expected patch operations")

			conditions := applyConditionPatchOps(t, tt.existingConditions, patchOps)
			assert.Len(t, conditions, tt.expectedConditions)

			for _, newCond := range tt.newConditions {
				found := false
				for _, c := range conditions {
					if c.Type == newCond.Type {
						assert.Equal(t, tt.generation, c.ObservedGeneration)
						assert.Equal(t, newCond.Status, c.Status)
						assert.Equal(t, newCond.Reason, c.Reason)
						assert.Equal(t, newCond.Message, c.Message)
						found = true
						break
					}
				}
				assert.True(t, found, "expected to find condition type %s", newCond.Type)
			}
		})
	}
}

func TestBuildConditionPatchOpsFromExisting_Connection(t *testing.T) {
	fixedTime := metav1.NewTime(time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC))

	tests := []struct {
		name               string
		existingConditions []metav1.Condition
		generation         int64
		newCondition       metav1.Condition
		expectPatch        bool
	}{
		{
			name:               "creates patch when no existing conditions",
			existingConditions: nil,
			generation:         1,
			newCondition: metav1.Condition{
				Type:    provisioning.ConditionTypeReady,
				Status:  metav1.ConditionTrue,
				Reason:  provisioning.ReasonAvailable,
				Message: "Resource is available",
			},
			expectPatch: true,
		},
		{
			name: "no patch when condition unchanged",
			existingConditions: []metav1.Condition{
				{
					Type:               provisioning.ConditionTypeReady,
					Status:             metav1.ConditionTrue,
					Reason:             provisioning.ReasonAvailable,
					Message:            "Resource is available",
					ObservedGeneration: 1,
					LastTransitionTime: fixedTime,
				},
			},
			generation: 1,
			newCondition: metav1.Condition{
				Type:    provisioning.ConditionTypeReady,
				Status:  metav1.ConditionTrue,
				Reason:  provisioning.ReasonAvailable,
				Message: "Resource is available",
			},
			expectPatch: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			patchOps := BuildConditionPatchOpsFromExisting(tt.existingConditions, tt.generation, tt.newCondition)

			if !tt.expectPatch {
				assert.Nil(t, patchOps, "expected no patch operations")
				return
			}

			require.NotNil(t, patchOps, "expected patch operations")

			conditions := applyConditionPatchOps(t, tt.existingConditions, patchOps)
			require.NotEmpty(t, conditions)

			readyCondition := findCondition(conditions, tt.newCondition.Type)
			require.NotNil(t, readyCondition, "expected condition of type %s", tt.newCondition.Type)
			assert.Equal(t, tt.generation, readyCondition.ObservedGeneration)
		})
	}
}

func findCondition(conditions []metav1.Condition, conditionType string) *metav1.Condition {
	for i := range conditions {
		if conditions[i].Type == conditionType {
			return &conditions[i]
		}
	}
	return nil
}
