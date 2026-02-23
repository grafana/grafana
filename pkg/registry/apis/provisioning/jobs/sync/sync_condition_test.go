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

func TestEvaluateSyncCondition(t *testing.T) {
	tests := []struct {
		name           string
		syncError      error
		expectedType   string
		expectedStatus metav1.ConditionStatus
		expectedReason string
		expectedMsg    string
	}{
		{
			name:           "successful sync",
			syncError:      nil,
			expectedType:   provisioning.ConditionTypeSyncStatus,
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonSyncSuccessful,
			expectedMsg:    "Sync completed successfully",
		},
		{
			name:           "quota exceeded error",
			syncError:      &quotas.QuotaExceededError{Err: fmt.Errorf("repository is over quota (current: 110 resources)")},
			expectedType:   provisioning.ConditionTypeSyncStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonSyncQuotaExceeded,
			expectedMsg:    "repository is over quota (current: 110 resources)",
		},
		{
			name:           "wrapped quota exceeded error",
			syncError:      fmt.Errorf("sync failed: %w", &quotas.QuotaExceededError{Err: fmt.Errorf("over quota")}),
			expectedType:   provisioning.ConditionTypeSyncStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonSyncQuotaExceeded,
			expectedMsg:    "sync failed: over quota",
		},
		{
			name:           "general sync error",
			syncError:      errors.New("network timeout"),
			expectedType:   provisioning.ConditionTypeSyncStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonSyncFailed,
			expectedMsg:    "network timeout",
		},
		{
			name:           "wrapped general error",
			syncError:      fmt.Errorf("sync failed: %w", errors.New("connection refused")),
			expectedType:   provisioning.ConditionTypeSyncStatus,
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonSyncFailed,
			expectedMsg:    "sync failed: connection refused",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			condition := EvaluateSyncCondition(tt.syncError)

			assert.Equal(t, tt.expectedType, condition.Type)
			assert.Equal(t, tt.expectedStatus, condition.Status)
			assert.Equal(t, tt.expectedReason, condition.Reason)
			assert.Equal(t, tt.expectedMsg, condition.Message)
		})
	}
}
