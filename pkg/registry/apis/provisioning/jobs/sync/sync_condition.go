package sync

import (
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// EvaluatePullCondition creates a PullStatus condition based on the outcome of a pull operation.
func EvaluatePullCondition(jobState provisioning.JobState, resultReasons []string) metav1.Condition {
	switch jobState {
	case provisioning.JobStateSuccess:
		return metav1.Condition{
			Type:    provisioning.ConditionTypePullStatus,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonSuccess,
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
			Reason:  provisioning.ReasonFailure,
			Message: "Pull completed with errors",
		}
	}
}

// resolveWarnings determines the condition reason and message from the warning reasons.
func resolveWarnings(resultReasons []string) (string, string) {
	if slices.Contains(resultReasons, provisioning.ReasonQuotaExceeded) {
		return provisioning.ReasonQuotaExceeded, "Pull completed with quota exceeded"
	}
	return provisioning.ReasonCompletedWithWarnings, "Pull completed with warnings"
}
