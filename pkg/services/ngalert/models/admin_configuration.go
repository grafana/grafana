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

	CreatedAt int64 `xorm:"created"`
	UpdatedAt int64 `xorm:"updated"`
}

func (ac *AdminConfiguration) AsSHA256() string {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%v", ac)))

	return fmt.Sprintf("%x", h.Sum(nil))
}

type GetOrgAdminConfiguration struct {
	OrgIDs []int64

	Result []*AdminConfiguration
}
