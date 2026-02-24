package sync

import (
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestEvaluatePullCondition(t *testing.T) {
	tests := []struct {
		name           string
		isQuotaError   bool
		jobState       provisioning.JobState
		expectedType   string
		expectedStatus metav1.ConditionStatus
		expectedReason string
		expectedMsg    string
	}{
		{
			name:           "successful pull",
			isQuotaError:   false,
			jobState:       provisioning.JobStateSuccess,
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonPullSuccessful,
			expectedMsg:    "Pull completed successfully",
		},
		{
			name:           "warning state without quota error",
			isQuotaError:   false,
			jobState:       provisioning.JobStateWarning,
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPullCompletedWithWarnings,
			expectedMsg:    "Pull completed with warnings",
		},
		{
			name:           "warning state with quota exceeded",
			isQuotaError:   true,
			jobState:       provisioning.JobStateWarning,
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonQuotaExceeded,
			expectedMsg:    "Pull completed with quota exceeded",
		},
		{
			name:           "error state without quota error",
			isQuotaError:   false,
			jobState:       provisioning.JobStateError,
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPullFailed,
			expectedMsg:    "Pull completed with errors",
		},
		{
			name:           "error state with quota error still uses PullFailed reason",
			isQuotaError:   true,
			jobState:       provisioning.JobStateError,
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPullFailed,
			expectedMsg:    "Pull completed with errors",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			condition := EvaluatePullCondition(tt.isQuotaError, tt.jobState)

			assert.Equal(t, tt.expectedType, condition.Type)
			assert.Equal(t, tt.expectedStatus, condition.Status)
			assert.Equal(t, tt.expectedReason, condition.Reason)
			assert.Equal(t, tt.expectedMsg, condition.Message)
		})
	}
}
