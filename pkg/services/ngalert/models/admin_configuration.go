package models

import (
	"crypto/sha256"
	"fmt"
)

// AdminConfiguration represents the ngalert administration configuration settings.
type AdminConfiguration struct {
	ID    int64 `xorm:"pk autoincr 'id'"`
	OrgID int64 `xorm:"org_id"`

	// List of Alertmanager(s) URL to push alerts to.
	Alertmanagers []string

	// Handling indicates which alertmanager will handle the alert:
	// 0: both internal and external alertmanagers.
	// 1: the internal alertmanager.
	// 2: the external alertmanagers.
	Handling int64 `xorm:"handling"`

	CreatedAt int64 `xorm:"created"`
	UpdatedAt int64 `xorm:"updated"`
}

func (ac *AdminConfiguration) AsSHA256() string {
	h := sha256.New()
	_, _ = h.Write([]byte(fmt.Sprintf("%v", ac.Alertmanagers)))
	return fmt.Sprintf("%x", h.Sum(nil))
}
