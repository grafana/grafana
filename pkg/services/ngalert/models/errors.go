package models

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errAlertRuleConflictMsg  = "conflicting alert rule found [UID: {{ .Public.UID }}, Title: {{ .Public.Title }}, NamespaceUID: {{ .Public.NamespaceUID }}]: {{ .Error }}"
	ErrAlertRuleConflictBase = errutil.Conflict("alerting.alert-rule.conflict").
					MustTemplate(errAlertRuleConflictMsg, errutil.WithPublic(errAlertRuleConflictMsg))
)

func ErrAlertRuleConflict(rule AlertRule, underlying error) error {
	return ErrAlertRuleConflictBase.Build(errutil.TemplateData{Public: map[string]any{"UID": rule.UID, "Title": rule.Title, "NamespaceUID": rule.NamespaceUID}, Error: underlying})
}
