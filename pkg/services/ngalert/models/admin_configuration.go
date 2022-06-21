package models

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"net/url"
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
	return 0, errors.New("invalid alertmanager choice")
}
