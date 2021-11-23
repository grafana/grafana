package models

import (
	"crypto/sha256"
	"fmt"
	"net/url"
)

type AlertmanagersChoice string

const (
	AllAlertmanagers      AlertmanagersChoice = "all"
	InternalAlertmanager  AlertmanagersChoice = "internal"
	ExternalAlertmanagers AlertmanagersChoice = "external"
)

// AdminConfiguration represents the ngalert administration configuration settings.
type AdminConfiguration struct {
	ID    int64 `xorm:"pk autoincr 'id'"`
	OrgID int64 `xorm:"org_id"`

	// List of Alertmanager(s) URL to push alerts to.
	Alertmanagers []string

	// SendAlertsTo indicates which set of alertmanagers will handle the alert.
	SendAlertsTo AlertmanagersChoice `xorm:"send_alerts_to"`

	CreatedAt int64 `xorm:"created"`
	UpdatedAt int64 `xorm:"updated"`
}

func (ac *AdminConfiguration) AsSHA256() string {
	h := sha256.New()
	_, _ = h.Write([]byte(fmt.Sprintf("%v", ac.Alertmanagers)))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func (ac *AdminConfiguration) Validate() error {
	for _, u := range ac.Alertmanagers {
		_, err := url.Parse(u)
		if err != nil {
			return err
		}
	}

	return nil
}

func (amc AlertmanagersChoice) IsValid() bool {
	return amc == AllAlertmanagers || amc == InternalAlertmanager || amc == ExternalAlertmanagers
}
