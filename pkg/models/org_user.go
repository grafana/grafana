package models

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

// Typed errors
var (
	ErrLastOrgAdmin        = errors.New("cannot remove last organization admin")
	ErrOrgUserNotFound     = errors.New("cannot find the organization user")
	ErrOrgUserAlreadyAdded = errors.New("user is already added to organization")
)

type OrgUser struct {
	Id      int64
	OrgId   int64
	UserId  int64
	Role    org.RoleType
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
	LoginOrEmail string       `json:"loginOrEmail" binding:"Required"`
	Role         org.RoleType `json:"role" binding:"Required"`

	OrgId  int64 `json:"-"`
	UserId int64 `json:"-"`

	// internal use: avoid adding service accounts to orgs via user routes
	AllowAddingServiceAccount bool `json:"-"`
}

type UpdateOrgUserCommand struct {
	Role org.RoleType `json:"role" binding:"Required"`

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

	User   *user.SignedInUser
	Result []*OrgUserDTO
}

type SearchOrgUsersQuery struct {
	OrgID int64
	Query string
	Page  int
	Limit int

	User   *user.SignedInUser
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
	IsDisabled    bool            `json:"isDisabled"`
}
