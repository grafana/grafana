package sync

import (
	"errors"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
)

// EvaluatePullCondition creates a PullStatus condition based on the outcome of a pull operation.
// True = last pull succeeded, False = last pull failed.
func EvaluatePullCondition(pullError error) metav1.Condition {
	if pullError == nil {
		return metav1.Condition{
			Type:    provisioning.ConditionTypePullStatus,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonPullSuccessful,
			Message: "Pull completed successfully",
		}
	}

	reason := provisioning.ReasonPullFailed
	var quotaErr *quotas.QuotaExceededError
	if errors.As(pullError, &quotaErr) {
		reason = provisioning.ReasonQuotaExceeded
	}

	return metav1.Condition{
		Type:    provisioning.ConditionTypePullStatus,
		Status:  metav1.ConditionFalse,
		Reason:  reason,
		Message: pullError.Error(),
	}
}
