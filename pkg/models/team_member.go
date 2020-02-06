package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrTeamMemberAlreadyAdded = errors.New("User is already added to this team")
)

// TeamMember model
type TeamMember struct {
	Id         int64
	OrgId      int64
	TeamId     int64
	UserId     int64
	External   bool // Signals that the membership has been created by an external systems, such as LDAP
	Permission PermissionType

	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type AddTeamMemberCommand struct {
	UserId     int64          `json:"userId" binding:"Required"`
	OrgId      int64          `json:"-"`
	TeamId     int64          `json:"-"`
	External   bool           `json:"-"`
	Permission PermissionType `json:"-"`
}

type UpdateTeamMemberCommand struct {
	UserId           int64          `json:"-"`
	OrgId            int64          `json:"-"`
	TeamId           int64          `json:"-"`
	Permission       PermissionType `json:"permission"`
	ProtectLastAdmin bool           `json:"-"`
}

type RemoveTeamMemberCommand struct {
	OrgId            int64 `json:"-"`
	UserId           int64
	TeamId           int64
	ProtectLastAdmin bool `json:"-"`
}

// ----------------------
// QUERIES

type GetTeamMembersQuery struct {
	OrgId    int64
	TeamId   int64
	UserId   int64
	External bool
	Result   []*TeamMemberDTO
}

// ----------------------
// Projections and DTOs

type TeamMemberDTO struct {
	OrgId      int64          `json:"orgId"`
	TeamId     int64          `json:"teamId"`
	UserId     int64          `json:"userId"`
	External   bool           `json:"-"`
	AuthModule string         `json:"auth_module"`
	Email      string         `json:"email"`
	Name       string         `json:"name"`
	Login      string         `json:"login"`
	AvatarUrl  string         `json:"avatarUrl"`
	Labels     []string       `json:"labels"`
	Permission PermissionType `json:"permission"`
}
