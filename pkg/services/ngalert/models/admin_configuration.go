package models

import (
	"fmt"
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

	CreatedAt int64 `xorm:"created"`
	UpdatedAt int64 `xorm:"updated"`
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
