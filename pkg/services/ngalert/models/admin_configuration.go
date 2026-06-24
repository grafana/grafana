package models

import (
	"fmt"
	"strings"
)

type AlertmanagersChoice int

const (
	AllAlertmanagers AlertmanagersChoice = iota
	InternalAlertmanager
	ExternalAlertmanagers
)

var alertmanagersChoiceMap = map[AlertmanagersChoice]string{
	AllAlertmanagers:      "all",
	InternalAlertmanager:  "internal",
	ExternalAlertmanagers: "external",
}

// AdminConfiguration represents the ngalert administration configuration settings.
type AdminConfiguration struct {
	ID    int64 `xorm:"pk autoincr 'id'"`
	OrgID int64 `xorm:"org_id"`

	// SendAlertsTo indicates which set of alertmanagers will handle the alert.
	SendAlertsTo *AlertmanagersChoice `xorm:"send_alerts_to"`

	// ExternalAlertmanagerUID is the UID of the Mimir/Cortex Alertmanager datasource whose
	// configuration should be synced into Grafana for this org. Empty means no sync.
	ExternalAlertmanagerUID *string `xorm:"external_alertmanager_uid"`

	// RejectAlertsWithoutDescriptions makes rule validation fail when an alert rule
	// is missing a summary or description annotation. Nil means unset (defaults to off).
	RejectAlertsWithoutDescriptions *bool `xorm:"reject_alerts_without_descriptions"`

	// AutoFillDescriptionsWithAI enables auto-generating missing summary/description
	// annotations via the LLM plugin in the UI. Nil means unset (defaults to off).
	AutoFillDescriptionsWithAI *bool `xorm:"auto_fill_descriptions_with_ai"`

	// RejectAlertsWithoutRunbookURL makes rule validation fail when an alert rule is
	// missing a runbook_url annotation. Nil means unset (defaults to off).
	RejectAlertsWithoutRunbookURL *bool `xorm:"reject_alerts_without_runbook_url"`

	CreatedAt int64 `xorm:"created"`
	UpdatedAt int64 `xorm:"updated"`
}

// RequiredAnnotations returns the user-facing annotation keys that alert rules must
// carry according to this admin configuration. An empty slice means no requirement.
func (amc *AdminConfiguration) RequiredAnnotations() []string {
	if amc == nil {
		return nil
	}
	var required []string
	if amc.RejectAlertsWithoutDescriptions != nil && *amc.RejectAlertsWithoutDescriptions {
		required = append(required, SummaryAnnotation, DescriptionAnnotation)
	}
	if amc.RejectAlertsWithoutRunbookURL != nil && *amc.RejectAlertsWithoutRunbookURL {
		required = append(required, RunbookURLAnnotation)
	}
	return required
}

// annotationDisplayNames maps internal annotation keys to the human-readable field
// labels shown in the rule editor, so error messages use the same terminology as the UI.
var annotationDisplayNames = map[string]string{
	SummaryAnnotation:     "Summary",
	DescriptionAnnotation: "Description",
	RunbookURLAnnotation:  "Runbook URL",
}

// ValidateRequiredAnnotations checks that the alert rule carries every annotation
// required by the org's admin configuration. Recording rules are exempt because they
// don't produce notifications. Returns ErrAlertRuleFailedValidation when any are missing.
func ValidateRequiredAnnotations(rule *AlertRule, cfg *AdminConfiguration) error {
	if rule == nil || rule.Record != nil {
		return nil
	}
	var missing []string
	for _, key := range cfg.RequiredAnnotations() {
		if strings.TrimSpace(rule.Annotations[key]) == "" {
			label := annotationDisplayNames[key]
			if label == "" {
				label = key
			}
			missing = append(missing, label)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("%w: alert rule is missing required fields: %s", ErrAlertRuleFailedValidation, strings.Join(missing, ", "))
	}
	return nil
}

// String implements the Stringer interface
func (amc AlertmanagersChoice) String() string {
	return alertmanagersChoiceMap[amc]
}

func StringToAlertmanagersChoice(str string) (AlertmanagersChoice, error) {
	if str == "" {
		return AllAlertmanagers, nil
	}

	for k, v := range alertmanagersChoiceMap {
		if str == v {
			return k, nil
		}
	}
	return 0, fmt.Errorf("invalid alertmanager choice: %q", str)
}
