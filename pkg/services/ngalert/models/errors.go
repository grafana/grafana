package models

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	errAlertRuleConflictMsg  = "conflicting alert rule found [rule_uid: '{{ .Public.RuleUID }}', title: '{{ .Public.Title }}', namespace_uid: '{{ .Public.NamespaceUID }}']: {{ .Public.Error }}"
	ErrAlertRuleConflictBase = errutil.Conflict("alerting.alert-rule.conflict").
					MustTemplate(errAlertRuleConflictMsg, errutil.WithPublic(errAlertRuleConflictMsg))
	ErrAlertRuleGroupNotFound       = errutil.NotFound("alerting.alert-rule.notFound")
	ErrInvalidRelativeTimeRangeBase = errutil.BadRequest("alerting.alert-rule.invalidRelativeTime").MustTemplate("Invalid alert rule query {{ .Public.RefID }}: invalid relative time range [From: {{ .Public.From }}, To: {{ .Public.To }}]")
	ErrConditionNotExistBase        = errutil.BadRequest("alerting.alert-rule.conditionNotExist").MustTemplate("Condition {{ .Public.Given }} does not exist, must be one of {{ .Public.Existing }}")
)

func ErrAlertRuleConflict(rule AlertRule, underlying error) error {
	return ErrAlertRuleConflictBase.Build(errutil.TemplateData{Public: map[string]any{"RuleUID": rule.UID, "Title": rule.Title, "NamespaceUID": rule.NamespaceUID, "Error": underlying.Error()}, Error: underlying})
}

func ErrInvalidRelativeTimeRange(refID string, rtr RelativeTimeRange) error {
	return ErrInvalidRelativeTimeRangeBase.Build(errutil.TemplateData{Public: map[string]any{"RefID": refID, "From": rtr.From, "To": rtr.To}})
}

func ErrConditionNotExist(given string, existing []string) error {
	return ErrConditionNotExistBase.Build(errutil.TemplateData{Public: map[string]any{"Given": given, "Existing": fmt.Sprintf("%v", existing)}})
}
