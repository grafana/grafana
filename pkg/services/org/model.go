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
	RoleViewer RoleType = "Viewer"
	RoleEditor RoleType = "Editor"
	RoleAdmin  RoleType = "Admin"
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

type GetUserOrgListQuery struct {
	UserID int64
}

type UserOrgDTO struct {
	OrgID int64    `json:"orgId"`
	Name  string   `json:"name"`
	Role  RoleType `json:"role"`
}

type UpdateOrgCommand struct {
	Name  string
	OrgId int64
}

func (r RoleType) IsValid() bool {
	return r == RoleViewer || r == RoleAdmin || r == RoleEditor
}

func (r RoleType) Includes(other RoleType) bool {
	if r == RoleAdmin {
		return true
	}

	if r == RoleEditor {
		return other != RoleAdmin
	}

	return r == other
}

func (r RoleType) Children() []RoleType {
	switch r {
	case RoleAdmin:
		return []RoleType{RoleEditor, RoleViewer}
	case RoleEditor:
		return []RoleType{RoleViewer}
	default:
		return nil
	}
}

func (r RoleType) Parents() []RoleType {
	switch r {
	case RoleEditor:
		return []RoleType{RoleAdmin}
	case RoleViewer:
		return []RoleType{RoleEditor, RoleAdmin}
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

		*r = RoleViewer
	}

	return nil
}
