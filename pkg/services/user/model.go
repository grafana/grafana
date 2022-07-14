package user

import (
	"time"
)

type HelpFlags1 uint64

type User struct {
	ID            int64 `xorm:"pk autoincr 'id'"`
	Version       int
	Email         string
	Name          string
	Login         string
	Password      string
	Salt          string
	Rands         string
	Company       string
	EmailVerified bool
	Theme         string
	HelpFlags1    HelpFlags1
	IsDisabled    bool

	IsAdmin          bool
	IsServiceAccount bool
	OrgID            int64 `xorm:"org_id"`

	Created    time.Time
	Updated    time.Time
	LastSeenAt time.Time
}

type CreateUserCommand struct {
	Email            string
	Login            string
	Name             string
	Company          string
	OrgID            int64
	OrgName          string
	Password         string
	EmailVerified    bool
	IsAdmin          bool
	IsDisabled       bool
	SkipOrgSetup     bool
	DefaultOrgRole   string
	IsServiceAccount bool
}

func (u *User) NameOrFallback() string {
	if u.Name != "" {
		return u.Name
	}
	if u.Login != "" {
		return u.Login
	}
	return u.Email
}

type DeleteUserCommand struct {
	UserID int64
}
