package checks

import (
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
)

func NewCheckReportFailure(
	severity advisor.CheckReportFailureSeverity,
	reason string,
	action string,
	stepID string,
	itemID string,
) *advisor.CheckReportFailure {
	return &advisor.CheckReportFailure{
		Severity: severity,
		Reason:   reason,
		Action:   action,
		StepID:   stepID,
		ItemID:   itemID,
	}
}
