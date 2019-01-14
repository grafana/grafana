package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	// Typed errors
	ErrOrgNotFound  = errors.New("Organization not found")
	ErrOrgNameTaken = errors.New("Organization name is taken")
	// define empty string
	EmptyString = "empty"
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

	Tenantlabel    string
	Tenantvalue    string
}

// ---------------------
// COMMANDS

type CreateOrgCommand struct {
	Name string `json:"name" binding:"Required"`
	Tenantlabel string `json:"tenantlabel"`
	Tenantvalue string `json:"tenantvalue"`

	// initial admin user for account
	UserId int64 `json:"-"`
	Result Org   `json:"-"`
}

type DeleteOrgCommand struct {
	Id int64
}

type UpdateOrgCommand struct {
	Name  string
	Tenantlabel  string
	Tenantvalue  string
	OrgId int64
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
	Tenantlabel  string
	Tenantvalue  string
	Limit int
	Page  int

	Result []*OrgDTO
}

type OrgDTO struct {
	Id   int64  `json:"id"`
	Name string `json:"name"`
	Tenantlabel    string  `json:"tenantlabel"`
	Tenantvalue    string  `json:"tenantvalue"`
}

type OrgDetailsDTO struct {
	Id      int64   `json:"id"`
	Name    string  `json:"name"`
	Tenantlabel    string  `json:"tenantlabel"`
	Tenantvalue    string  `json:"tenantvalue"`
	Address Address `json:"address"`
}

type UserOrgDTO struct {
	OrgId int64    `json:"orgId"`
	Name  string   `json:"name"`
	Tenantlabel    string  `json:"tenantlabel"`
	Tenantvalue    string  `json:"tenantvalue"`
	Role  RoleType `json:"role"`
}
