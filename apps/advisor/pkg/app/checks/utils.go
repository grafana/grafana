package checks

import (
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
)

const (
	TypeLabel        = "advisor.grafana.app/type"
	StatusAnnotation = "advisor.grafana.app/status"
)

func NewCheckReportFailure(
	severity advisor.CheckReportFailureSeverity,
	stepID string,
	item string,
	links []advisor.CheckErrorLink,
) *advisor.CheckReportFailure {
	return &advisor.CheckReportFailure{
		Severity: severity,
		StepID:   stepID,
		Item:     item,
		Links:    links,
	}
}
