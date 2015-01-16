package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrInvalidRoleType = errors.New("Invalid role type")
)

type RoleType string

const (
	ROLE_OWNER  RoleType = "Owner"
	ROLE_VIEWER RoleType = "Viewer"
	ROLE_EDITOR RoleType = "Editor"
	ROLE_ADMIN  RoleType = "Admin"
)

func (r RoleType) IsValid() bool {
	return r == ROLE_VIEWER || r == ROLE_ADMIN || r == ROLE_EDITOR
}

type Collaborator struct {
	Id             int64
	AccountId      int64    `xorm:"not null unique(uix_account_id_for_account_id)"`
	Role           RoleType `xorm:"not null"`
	CollaboratorId int64    `xorm:"not null unique(uix_account_id_for_account_id)"`

	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type RemoveCollaboratorCommand struct {
	CollaboratorId int64
	AccountId      int64
}

type AddCollaboratorCommand struct {
	LoginOrEmail   string   `json:"loginOrEmail" binding:"Required"`
	Role           RoleType `json:"role" binding:"Required"`
	AccountId      int64    `json:"-"`
	CollaboratorId int64    `json:"-"`
}

// ----------------------
// QUERIES

type GetCollaboratorsQuery struct {
	AccountId int64
	Result    []*CollaboratorDTO
}

// ----------------------
// Projections and DTOs

type CollaboratorDTO struct {
	CollaboratorId int64  `json:"id"`
	Email          string `json:"email"`
	Login          string `json:"login"`
	Role           string `json:"role"`
}
