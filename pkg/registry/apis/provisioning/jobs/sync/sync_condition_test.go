package sync

import (
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

func TestEvaluatePullCondition(t *testing.T) {
	tests := []struct {
		name           string
		jobState       provisioning.JobState
		warningReasons []jobs.JobWarningReason
		expectedType   string
		expectedStatus metav1.ConditionStatus
		expectedReason string
		expectedMsg    string
	}{
		{
			name:           "successful pull",
			jobState:       provisioning.JobStateSuccess,
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonPullSuccessful,
			expectedMsg:    "Pull completed successfully",
		},
		{
			name:           "warning state without typed reason",
			jobState:       provisioning.JobStateWarning,
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPullCompletedWithWarnings,
			expectedMsg:    "Pull completed with warnings",
		},
		{
			name:           "warning state with quota exceeded",
			jobState:       provisioning.JobStateWarning,
			warningReasons: []jobs.JobWarningReason{jobs.WarningQuotaExceeded},
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonQuotaExceeded,
			expectedMsg:    "Pull completed with quota exceeded",
		},
		{
			name:           "error state without warning reasons",
			jobState:       provisioning.JobStateError,
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPullFailed,
			expectedMsg:    "Pull completed with errors",
		},
		{
			name:           "error state with quota reason still uses PullFailed reason",
			jobState:       provisioning.JobStateError,
			warningReasons: []jobs.JobWarningReason{jobs.WarningQuotaExceeded},
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPullFailed,
			expectedMsg:    "Pull completed with errors",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			condition := EvaluatePullCondition(tt.jobState, tt.warningReasons)

			assert.Equal(t, tt.expectedType, condition.Type)
			assert.Equal(t, tt.expectedStatus, condition.Status)
			assert.Equal(t, tt.expectedReason, condition.Reason)
			assert.Equal(t, tt.expectedMsg, condition.Message)
		})
	}
}
