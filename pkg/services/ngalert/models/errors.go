package models

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errAlertRuleConflictMsg  = "conflicting alert rule found [rule_uid: '{{ .Public.RuleUID }}', title: '{{ .Public.Title }}', namespace_uid: '{{ .Public.NamespaceUID }}']: {{ .Public.Error }}"
	ErrAlertRuleConflictBase = errutil.Conflict("alerting.alert-rule.conflict").
					MustTemplate(errAlertRuleConflictMsg, errutil.WithPublic(errAlertRuleConflictMsg))
	ErrAlertRuleGroupNotFound = errutil.NotFound("alerting.alert-rule.notFound")
)

func ErrAlertRuleConflict(rule AlertRule, underlying error) error {
	return ErrAlertRuleConflictBase.Build(errutil.TemplateData{Public: map[string]any{"RuleUID": rule.UID, "Title": rule.Title, "NamespaceUID": rule.NamespaceUID, "Error": underlying.Error()}, Error: underlying})
}
