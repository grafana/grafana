package checks

import (
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
)

func NewCheckReportError(
	severity advisor.CheckReportErrorSeverity,
	reason string,
	action string,
	stepID string,
	itemID string,
) advisor.CheckReportError {
	return advisor.CheckReportError{
		Severity: severity,
		Reason:   reason,
		Action:   action,
		StepID:   stepID,
		ItemID:   itemID,
	}
}
