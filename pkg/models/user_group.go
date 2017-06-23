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
	Id    int64  `json:"id"`
	OrgId int64  `json:"orgId"`
	Name  string `json:"name"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

// ---------------------
// COMMANDS

type CreateUserGroupCommand struct {
	Name  string `json:"name" binding:"Required"`
	OrgId int64  `json:"-"`

	Result UserGroup `json:"-"`
}

type UpdateUserGroupCommand struct {
	Id   int64
	Name string
}

type DeleteUserGroupCommand struct {
	Id int64
}

type GetUserGroupByIdQuery struct {
	Id     int64
	Result *UserGroup
}

type GetUserGroupsByUserQuery struct {
	UserId int64        `json:"userId"`
	Result []*UserGroup `json:"userGroups"`
}

type SearchUserGroupsQuery struct {
	Query string
	Name  string
	Limit int
	Page  int
	OrgId int64

	Result SearchUserGroupQueryResult
}

type SearchUserGroupQueryResult struct {
	TotalCount int64        `json:"totalCount"`
	UserGroups []*UserGroup `json:"userGroups"`
	Page       int          `json:"page"`
	PerPage    int          `json:"perPage"`
}
