package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrOrgNotFound  = errors.New("Organization not found")
	ErrOrgNameTaken = errors.New("Organization name is taken")
)

type Org struct {
	Id      int64
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
	Name   string
	Shared bool
	OrgId  int64
}

type UpdateOrgAddressCommand struct {
	OrgId int64
	Address
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

type OrgDetailsDTO struct {
	Id      int64   `json:"id"`
	Name    string  `json:"name"`
	Address Address `json:"address"`
}

type UserOrgDTO struct {
	OrgId int64    `json:"orgId"`
	Name  string   `json:"name"`
	Role  RoleType `json:"role"`
}
