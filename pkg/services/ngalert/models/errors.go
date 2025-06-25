package models

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	errAlertRuleConflictMsg         = "Failed to save alert rule '{{ .Public.RuleUID }}' in organization {{ .Public.OrgID }} due to conflict: {{ .Public.Error }}"
	ErrAlertRuleConflictBase        = errutil.Conflict("alerting.alert-rule.conflict").MustTemplate(errAlertRuleConflictMsg, errutil.WithPublic(errAlertRuleConflictMsg))
	ErrAlertRuleGroupNotFound       = errutil.NotFound("alerting.alert-rule.notFound")
	ErrInvalidRelativeTimeRangeBase = errutil.BadRequest("alerting.alert-rule.invalidRelativeTime").MustTemplate("Invalid alert rule query {{ .Public.RefID }}: invalid relative time range [From: {{ .Public.From }}, To: {{ .Public.To }}]")
	ErrConditionNotExistBase        = errutil.BadRequest("alerting.alert-rule.conditionNotExist").MustTemplate("Condition {{ .Public.Given }} does not exist, must be one of {{ .Public.Existing }}")
)

func ErrAlertRuleConflict(ruleUID string, orgID int64, err error) error {
	return ErrAlertRuleConflictBase.Build(errutil.TemplateData{Public: map[string]any{"RuleUID": ruleUID, "OrgID": orgID, "Error": err.Error()}, Error: err})
}

func ErrInvalidRelativeTimeRange(refID string, rtr RelativeTimeRange) error {
	return ErrInvalidRelativeTimeRangeBase.Build(errutil.TemplateData{Public: map[string]any{"RefID": refID, "From": rtr.From, "To": rtr.To}})
}

func ErrConditionNotExist(given string, existing []string) error {
	return ErrConditionNotExistBase.Build(errutil.TemplateData{Public: map[string]any{"Given": given, "Existing": fmt.Sprintf("%v", existing)}})
}
