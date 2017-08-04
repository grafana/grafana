package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrUserGroupMemberAlreadyAdded = errors.New("User is already added to this user group")
)

// UserGroupMember model
type UserGroupMember struct {
	Id          int64
	OrgId       int64
	UserGroupId int64
	UserId      int64

	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type AddUserGroupMemberCommand struct {
	UserId      int64 `json:"userId" binding:"Required"`
	OrgId       int64 `json:"-"`
	UserGroupId int64 `json:"-"`
}

type RemoveUserGroupMemberCommand struct {
	UserId      int64
	UserGroupId int64
}

// ----------------------
// QUERIES

type GetUserGroupMembersQuery struct {
	UserGroupId int64
	Result      []*UserGroupMemberDTO
}

// ----------------------
// Projections and DTOs

type UserGroupMemberDTO struct {
	OrgId       int64  `json:"orgId"`
	UserGroupId int64  `json:"userGroupId"`
	UserId      int64  `json:"userId"`
	Email       string `json:"email"`
	Login       string `json:"login"`
}
