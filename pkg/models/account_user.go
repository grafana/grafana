package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrInvalidRoleType  = errors.New("Invalid role type")
	ErrLastAccountAdmin = errors.New("Cannot remove last account admin")
)

type RoleType string

const (
	ROLE_VIEWER RoleType = "Viewer"
	ROLE_EDITOR RoleType = "Editor"
	ROLE_ADMIN  RoleType = "Admin"
)

func (r RoleType) IsValid() bool {
	return r == ROLE_VIEWER || r == ROLE_ADMIN || r == ROLE_EDITOR
}

type AccountUser struct {
	AccountId int64
	UserId    int64
	Role      RoleType
	Created   time.Time
	Updated   time.Time
}

// ---------------------
// COMMANDS

type RemoveAccountUserCommand struct {
	UserId    int64
	AccountId int64
}

type AddAccountUserCommand struct {
	LoginOrEmail string   `json:"loginOrEmail" binding:"Required"`
	Role         RoleType `json:"role" binding:"Required"`

	AccountId int64 `json:"-"`
	UserId    int64 `json:"-"`
}

// ----------------------
// QUERIES

type GetAccountUsersQuery struct {
	AccountId int64
	Result    []*AccountUserDTO
}

// ----------------------
// Projections and DTOs

type AccountUserDTO struct {
	AccountId int64  `json:"accountId"`
	UserId    int64  `json:"userId"`
	Email     string `json:"email"`
	Login     string `json:"login"`
	Role      string `json:"role"`
}
