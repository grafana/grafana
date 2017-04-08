package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrUserGroupNotFound  = errors.New("User Group not found")
	ErrUserGroupNameTaken = errors.New("User Group name is taken")
)

// UserGroup model
type UserGroup struct {
	Id    int64
	OrgId int64
	Name  string

	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type CreateUserGroupCommand struct {
	Name  string `json:"name" binding:"Required"`
	OrgId int64  `json:"orgId" binding:"Required"`

	Result UserGroup `json:"-"`
}

type DeleteUserGroupCommand struct {
	Id int64
}

type GetUserGroupByIdQuery struct {
	Id     int64
	Result *UserGroup
}

type SearchUserGroupsQuery struct {
	Query string
	Name  string
	Limit int
	Page  int

	Result []*UserGroup
}
