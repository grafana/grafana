package models

import (
	"crypto/sha256"
	"fmt"
)

type AlertmanagersChoice int

const (
	AllAlertmanagers AlertmanagersChoice = iota
	InternalAlertmanager
	ExternalAlertmanagers
)

// AdminConfiguration represents the ngalert administration configuration settings.
type AdminConfiguration struct {
	ID    int64 `xorm:"pk autoincr 'id'"`
	OrgID int64 `xorm:"org_id"`

	// List of Alertmanager(s) URL to push alerts to.
	Alertmanagers []string

	// AlertmanagersChoice indicates which set of alertmanagers will handle the alert.
	AlertmanagersChoice AlertmanagersChoice `xorm:"alertmanagers_choice"`

	CreatedAt int64 `xorm:"created"`
	UpdatedAt int64 `xorm:"updated"`
}

func (ac *AdminConfiguration) AsSHA256() string {
	h := sha256.New()
	_, _ = h.Write([]byte(fmt.Sprintf("%v", ac.Alertmanagers)))
	return fmt.Sprintf("%x", h.Sum(nil))
}
