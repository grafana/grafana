package sync

import (
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// EvaluatePullCondition creates a PullStatus condition based on the outcome of a pull operation.
func EvaluatePullCondition(jobState provisioning.JobState, resultReasons []provisioning.JobResultReason) metav1.Condition {
	switch jobState {
	case provisioning.JobStateSuccess:
		return metav1.Condition{
			Type:    provisioning.ConditionTypePullStatus,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonPullSuccessful,
			Message: "Pull completed successfully",
		}

	case provisioning.JobStateWarning:
		reason, message := resolveWarnings(resultReasons)
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

// resolveWarnings determines the condition reason and message from the warning reasons.
func resolveWarnings(resultReasons []provisioning.JobResultReason) (string, string) {
	if slices.Contains(resultReasons, provisioning.WarningQuotaExceeded) {
		return provisioning.ReasonQuotaExceeded, "Pull completed with quota exceeded"
	}
	return provisioning.ReasonPullCompletedWithWarnings, "Pull completed with warnings"
}
