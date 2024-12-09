package models

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	errAlertRuleConflictMsg        = "conflicting alert rule found [rule_uid: '{{ .Public.RuleUID }}', title: '{{ .Public.Title }}', namespace_uid: '{{ .Public.NamespaceUID }}']: {{ .Public.Error }}"
	errAlertRuleConflictMsgVerbose = "alert rule [rule_uid: '{{ .Public.New.RuleUID }}', title: '{{ .Public.New.Title }}', namespace_uid: '{{ .Public.New.NamespaceUID }}'] conflicts with existing [rule_uid: '{{ .Public.Existing.RuleUID }}', title: '{{ .Public.Existing.Title }}', namespace_uid: '{{ .Public.Existing.NamespaceUID }}']: {{ .Public.Error }}"
	ErrAlertRuleConflictBase       = errutil.Conflict("alerting.alert-rule.conflict").
					MustTemplate(errAlertRuleConflictMsg, errutil.WithPublic(errAlertRuleConflictMsg))
	ErrAlertRuleConflictBaseVerbose = errutil.Conflict("alerting.alert-rule.conflict").
					MustTemplate(errAlertRuleConflictMsgVerbose, errutil.WithPublic(errAlertRuleConflictMsgVerbose))
	ErrAlertRuleGroupNotFound       = errutil.NotFound("alerting.alert-rule.notFound")
	ErrInvalidRelativeTimeRangeBase = errutil.BadRequest("alerting.alert-rule.invalidRelativeTime").MustTemplate("Invalid alert rule query {{ .Public.RefID }}: invalid relative time range [From: {{ .Public.From }}, To: {{ .Public.To }}]")
	ErrConditionNotExistBase        = errutil.BadRequest("alerting.alert-rule.conditionNotExist").MustTemplate("Condition {{ .Public.Given }} does not exist, must be one of {{ .Public.Existing }}")
)

func ErrAlertRuleConflict(rule AlertRule, underlying error) error {
	return ErrAlertRuleConflictBase.Build(errutil.TemplateData{Public: map[string]any{"RuleUID": rule.UID, "Title": rule.Title, "NamespaceUID": rule.NamespaceUID, "Error": underlying.Error()}, Error: underlying})
}

func ErrAlertRuleConflictVerbose(existingPartialRule, rule AlertRule, underlying error) error {
	return ErrAlertRuleConflictBaseVerbose.Build(errutil.TemplateData{Public: map[string]any{
		"New": map[string]any{
			"RuleUID":      rule.UID,
			"Title":        rule.Title,
			"NamespaceUID": rule.NamespaceUID,
		},
		"Existing": map[string]any{
			"RuleUID":      existingPartialRule.UID,
			"Title":        existingPartialRule.Title,
			"NamespaceUID": existingPartialRule.NamespaceUID,
		},
		"Error": underlying.Error(),
	}, Error: underlying})
}

func ErrInvalidRelativeTimeRange(refID string, rtr RelativeTimeRange) error {
	return ErrInvalidRelativeTimeRangeBase.Build(errutil.TemplateData{Public: map[string]any{"RefID": refID, "From": rtr.From, "To": rtr.To}})
}

func ErrConditionNotExist(given string, existing []string) error {
	return ErrConditionNotExistBase.Build(errutil.TemplateData{Public: map[string]any{"Given": given, "Existing": fmt.Sprintf("%v", existing)}})
}
