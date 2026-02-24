package sync

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// EvaluatePullCondition creates a PullStatus condition based on the outcome of a pull operation.
// True = last pull succeeded, False = last pull failed or completed with warnings/errors.
func EvaluatePullCondition(isQuotaError bool, jobState provisioning.JobState) metav1.Condition {
	switch jobState {
	case provisioning.JobStateSuccess:
		return metav1.Condition{
			Type:    provisioning.ConditionTypePullStatus,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonPullSuccessful,
			Message: "Pull completed successfully",
		}

	case provisioning.JobStateWarning:
		reason := provisioning.ReasonPullCompletedWithWarnings
		message := "Pull completed with warnings"
		if isQuotaError {
			reason = provisioning.ReasonQuotaExceeded
			message = "Pull completed with quota exceeded"
		}
		return metav1.Condition{
			Type:    provisioning.ConditionTypePullStatus,
			Status:  metav1.ConditionFalse,
			Reason:  reason,
			Message: message,
		}

	default:
		return metav1.Condition{
			Type:    provisioning.ConditionTypePullStatus,
			Status:  metav1.ConditionFalse,
			Reason:  provisioning.ReasonPullFailed,
			Message: "Pull completed with errors",
		}
	}
}
