package controller

import (
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
		name                string
		existingConditions  []metav1.Condition
		generation          int64
		newCondition        metav1.Condition
		expectPatch         bool
		expectedConditions  int
		validateLastTransit bool
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
			newCondition: metav1.Condition{
				Type:    provisioning.ConditionTypeReady,
				Status:  metav1.ConditionTrue,
				Reason:  provisioning.ReasonAvailable,
				Message: "Resource is available",
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
			newCondition: metav1.Condition{
				Type:    provisioning.ConditionTypeReady,
				Status:  metav1.ConditionTrue,
				Reason:  provisioning.ReasonAvailable,
				Message: "Resource is available",
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
			newCondition: metav1.Condition{
				Type:    provisioning.ConditionTypeReady,
				Status:  metav1.ConditionTrue,
				Reason:  provisioning.ReasonAvailable,
				Message: "Resource is available",
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
			newCondition: metav1.Condition{
				Type:    provisioning.ConditionTypeReady,
				Status:  metav1.ConditionTrue,
				Reason:  "DifferentReason",
				Message: "Resource is available",
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
			newCondition: metav1.Condition{
				Type:    provisioning.ConditionTypeReady,
				Status:  metav1.ConditionTrue,
				Reason:  provisioning.ReasonAvailable,
				Message: "Different message",
			},
			expectPatch:        true,
			expectedConditions: 1,
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
			require.Len(t, patchOps, 1, "expected exactly one patch operation")

			patch := patchOps[0]
			assert.Equal(t, "replace", patch["op"])
			assert.Equal(t, "/status/conditions", patch["path"])

			conditions, ok := patch["value"].([]metav1.Condition)
			require.True(t, ok, "patch value should be []metav1.Condition")
			assert.Len(t, conditions, tt.expectedConditions)

			// Verify ObservedGeneration is set
			readyCondition := conditions[0]
			assert.Equal(t, tt.generation, readyCondition.ObservedGeneration)
			assert.Equal(t, tt.newCondition.Type, readyCondition.Type)
			assert.Equal(t, tt.newCondition.Status, readyCondition.Status)
			assert.Equal(t, tt.newCondition.Reason, readyCondition.Reason)
			assert.Equal(t, tt.newCondition.Message, readyCondition.Message)
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
			require.Len(t, patchOps, 1, "expected exactly one patch operation")

			patch := patchOps[0]
			assert.Equal(t, "replace", patch["op"])
			assert.Equal(t, "/status/conditions", patch["path"])

			conditions, ok := patch["value"].([]metav1.Condition)
			require.True(t, ok, "patch value should be []metav1.Condition")

			// Verify ObservedGeneration is set
			readyCondition := conditions[0]
			assert.Equal(t, tt.generation, readyCondition.ObservedGeneration)
		})
	}
}
