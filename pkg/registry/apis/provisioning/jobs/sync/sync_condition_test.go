package sync

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
)

func TestEvaluatePullCondition(t *testing.T) {
	tests := []struct {
		name           string
		pullError      error
		expectedType   string
		expectedStatus metav1.ConditionStatus
		expectedReason string
		expectedMsg    string
	}{
		{
			name:           "successful pull",
			pullError:      nil,
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonPullSuccessful,
			expectedMsg:    "Pull completed successfully",
		},
		{
			name:           "quota exceeded error",
			pullError:      &quotas.QuotaExceededError{Err: fmt.Errorf("repository is over quota (current: 110 resources)")},
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonQuotaExceeded,
			expectedMsg:    "repository is over quota (current: 110 resources)",
		},
		{
			name:           "wrapped quota exceeded error",
			pullError:      fmt.Errorf("pull failed: %w", &quotas.QuotaExceededError{Err: fmt.Errorf("over quota")}),
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonQuotaExceeded,
			expectedMsg:    "pull failed: over quota",
		},
		{
			name:           "general pull error",
			pullError:      errors.New("network timeout"),
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPullFailed,
			expectedMsg:    "network timeout",
		},
		{
			name:           "wrapped general error",
			pullError:      fmt.Errorf("pull failed: %w", errors.New("connection refused")),
			expectedType:   provisioning.ConditionTypePullStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPullFailed,
			expectedMsg:    "pull failed: connection refused",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			condition := EvaluatePullCondition(tt.pullError)

			assert.Equal(t, tt.expectedType, condition.Type)
			assert.Equal(t, tt.expectedStatus, condition.Status)
			assert.Equal(t, tt.expectedReason, condition.Reason)
			assert.Equal(t, tt.expectedMsg, condition.Message)
		})
	}
}
