package org

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

// Typed errors
var (
	ErrOrgNotFound  = errors.New("organization not found")
	ErrOrgNameTaken = errors.New("organization name is taken")
)

type Org struct {
	ID      int64 `xorm:"pk autoincr 'id'"`
	Version int
	Name    string

	Address1 string
	Address2 string
	City     string
	ZipCode  string
	State    string
	Country  string

	Created time.Time
	Updated time.Time
}
type OrgUser struct {
	ID      int64 `xorm:"pk autoincr 'id'"`
	OrgID   int64 `xorm:"org_id"`
	UserID  int64 `xorm:"user_id"`
	Role    RoleType
	Created time.Time
	Updated time.Time
}

// swagger:enum RoleType
type RoleType string

const (
	ROLE_VIEWER RoleType = "Viewer"
	ROLE_EDITOR RoleType = "Editor"
	ROLE_ADMIN  RoleType = "Admin"
)

type CreateOrgCommand struct {
	Name string `json:"name" binding:"Required"`

	// initial admin user for account
	UserID int64 `json:"-"`
}

type GetOrgIDForNewUserCommand struct {
	Email        string
	Login        string
	OrgID        int64
	OrgName      string
	SkipOrgSetup bool
}

func (r RoleType) IsValid() bool {
	return r == ROLE_VIEWER || r == ROLE_ADMIN || r == ROLE_EDITOR
}

func (r RoleType) Includes(other RoleType) bool {
	if r == ROLE_ADMIN {
		return true
	}

	if r == ROLE_EDITOR {
		return other != ROLE_ADMIN
	}

	return r == other
}

func (r RoleType) Children() []RoleType {
	switch r {
	case ROLE_ADMIN:
		return []RoleType{ROLE_EDITOR, ROLE_VIEWER}
	case ROLE_EDITOR:
		return []RoleType{ROLE_VIEWER}
	default:
		return nil
	}
}

func (r RoleType) Parents() []RoleType {
	switch r {
	case ROLE_EDITOR:
		return []RoleType{ROLE_ADMIN}
	case ROLE_VIEWER:
		return []RoleType{ROLE_EDITOR, ROLE_ADMIN}
	default:
		return nil
	}
}

func (r *RoleType) UnmarshalText(data []byte) error {
	// make sure "viewer" and "Viewer" are both correct
	str := strings.Title(string(data))

	*r = RoleType(str)
	if !r.IsValid() {
		if (*r) != "" {
			return fmt.Errorf("invalid role value: %s", *r)
		}

		*r = ROLE_VIEWER
	}

	return nil
}
