package models

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

// Typed errors
var (
	ErrLastOrgAdmin        = errors.New("cannot remove last organization admin")
	ErrOrgUserNotFound     = errors.New("cannot find the organization user")
	ErrOrgUserAlreadyAdded = errors.New("user is already added to organization")
)

// swagger:enum RoleType
type RoleType string

const (
	ROLE_VIEWER RoleType = "Viewer"
	ROLE_EDITOR RoleType = "Editor"
	ROLE_ADMIN  RoleType = "Admin"
)

func (r RoleType) IsValid() bool {
	return r == ROLE_VIEWER || r == ROLE_ADMIN || r == ROLE_EDITOR
}

func (r RoleType) Includes(other RoleType) bool {
	if r == ROLE_ADMIN {
		return true
	}

	if r == ROLE_EDITOR {
		return other != ROLE_ADMIN
	}

	return r == other
}

func (r RoleType) Children() []RoleType {
	switch r {
	case ROLE_ADMIN:
		return []RoleType{ROLE_EDITOR, ROLE_VIEWER}
	case ROLE_EDITOR:
		return []RoleType{ROLE_VIEWER}
	default:
		return nil
	}
}

func (r RoleType) Parents() []RoleType {
	switch r {
	case ROLE_EDITOR:
		return []RoleType{ROLE_ADMIN}
	case ROLE_VIEWER:
		return []RoleType{ROLE_EDITOR, ROLE_ADMIN}
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

		*r = ROLE_VIEWER
	}

	return nil
}

type OrgUser struct {
	Id      int64
	OrgId   int64
	UserId  int64
	Role    RoleType
	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type RemoveOrgUserCommand struct {
	UserId                   int64
	OrgId                    int64
	ShouldDeleteOrphanedUser bool
	UserWasDeleted           bool
}

type AddOrgUserCommand struct {
	LoginOrEmail string   `json:"loginOrEmail" binding:"Required"`
	Role         RoleType `json:"role" binding:"Required"`

	OrgId  int64 `json:"-"`
	UserId int64 `json:"-"`

	// internal use: avoid adding service accounts to orgs via user routes
	AllowAddingServiceAccount bool `json:"-"`
}

type UpdateOrgUserCommand struct {
	Role RoleType `json:"role" binding:"Required"`

	OrgId  int64 `json:"-"`
	UserId int64 `json:"-"`
}

// ----------------------
// QUERIES

type GetOrgUsersQuery struct {
	UserID int64
	OrgId  int64
	Query  string
	Limit  int
	// Flag used to allow oss edition to query users without access control
	DontEnforceAccessControl bool

	User   *SignedInUser
	Result []*OrgUserDTO
}

type SearchOrgUsersQuery struct {
	OrgID int64
	Query string
	Page  int
	Limit int

	User   *SignedInUser
	Result SearchOrgUsersQueryResult
}

type SearchOrgUsersQueryResult struct {
	TotalCount int64         `json:"totalCount"`
	OrgUsers   []*OrgUserDTO `json:"OrgUsers"`
	Page       int           `json:"page"`
	PerPage    int           `json:"perPage"`
}

// ----------------------
// Projections and DTOs

type OrgUserDTO struct {
	OrgId         int64           `json:"orgId"`
	UserId        int64           `json:"userId"`
	Email         string          `json:"email"`
	Name          string          `json:"name"`
	AvatarUrl     string          `json:"avatarUrl"`
	Login         string          `json:"login"`
	Role          string          `json:"role"`
	LastSeenAt    time.Time       `json:"lastSeenAt"`
	Updated       time.Time       `json:"-"`
	Created       time.Time       `json:"-"`
	LastSeenAtAge string          `json:"lastSeenAtAge"`
	AccessControl map[string]bool `json:"accessControl,omitempty"`
}
