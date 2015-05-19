package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrOrgNotFound = errors.New("Organization not found")
)

type Org struct {
	Id      int64
	Version int
	Name    string
	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type CreateOrgCommand struct {
	Name string `json:"name" binding:"Required"`

	// initial admin user for account
	UserId int64 `json:"-"`
	Result Org   `json:"-"`
}

type DeleteOrgCommand struct {
	Id int64
}

type UpdateOrgCommand struct {
	Name  string `json:"name" binding:"Required"`
	OrgId int64  `json:"-"`
}

type GetOrgByIdQuery struct {
	Id     int64
	Result *Org
}

type GetOrgByNameQuery struct {
	Name   string
	Result *Org
}

type SearchOrgsQuery struct {
	Query string
	Name  string
	Limit int
	Page  int

	Result []*OrgDTO
}

type OrgDTO struct {
	Id   int64  `json:"id"`
	Name string `json:"name"`
}

type UserOrgDTO struct {
	OrgId int64    `json:"orgId"`
	Name  string   `json:"name"`
	Role  RoleType `json:"role"`
}
