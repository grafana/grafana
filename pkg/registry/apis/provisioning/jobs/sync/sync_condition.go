package sync

import (
	"errors"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
)

// EvaluateSyncCondition creates a SyncStatus condition based on the outcome of a sync (pull) operation.
// True = last sync succeeded, False = last sync failed.
func EvaluateSyncCondition(syncError error) metav1.Condition {
	if syncError == nil {
		return metav1.Condition{
			Type:    provisioning.ConditionTypeSyncStatus,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonSyncSuccessful,
			Message: "Sync completed successfully",
		}
	}

	var quotaErr *quotas.QuotaExceededError
	if errors.As(syncError, &quotaErr) {
		return metav1.Condition{
			Type:    provisioning.ConditionTypeSyncStatus,
			Status:  metav1.ConditionFalse,
			Reason:  provisioning.ReasonSyncQuotaExceeded,
			Message: syncError.Error(),
		}
	}

	return metav1.Condition{
		Type:    provisioning.ConditionTypeSyncStatus,
		Status:  metav1.ConditionFalse,
		Reason:  provisioning.ReasonSyncFailed,
		Message: syncError.Error(),
	}
}
