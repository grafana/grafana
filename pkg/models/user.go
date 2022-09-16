package models

import (
	"time"

	"github.com/grafana/grafana/pkg/services/user"
)

type Password string

func (p Password) IsWeak() bool {
	return len(p) <= 4
}

type UpdateUserCommand struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Login string `json:"login"`
	Theme string `json:"theme"`

	UserId int64 `json:"-"`
}

type ChangeUserPasswordCommand struct {
	OldPassword string `json:"oldPassword"`
	NewPassword string `json:"newPassword"`

	UserId int64 `json:"-"`
}

type DisableUserCommand struct {
	UserId     int64
	IsDisabled bool
}

type BatchDisableUsersCommand struct {
	UserIds    []int64
	IsDisabled bool
}

type DeleteUserCommand struct {
	UserId int64
}

type SetUsingOrgCommand struct {
	UserId int64
	OrgId  int64
}

// ----------------------
// QUERIES

type GetUserByLoginQuery struct {
	LoginOrEmail string
	Result       *user.User
}

type GetUserByEmailQuery struct {
	Email  string
	Result *user.User
}

type GetUserByIdQuery struct {
	Id     int64
	Result *user.User
}

type GetSignedInUserQuery struct {
	UserId int64
	Login  string
	Email  string
	OrgId  int64
	Result *user.SignedInUser
}

type GetUserProfileQuery struct {
	UserId int64
	Result UserProfileDTO
}

type SearchUsersQuery struct {
	SignedInUser *user.SignedInUser
	OrgId        int64
	Query        string
	Page         int
	Limit        int
	AuthModule   string
	Filters      []user.Filter

	IsDisabled *bool

	Result SearchUserQueryResult
}

type SearchUserQueryResult struct {
	TotalCount int64               `json:"totalCount"`
	Users      []*UserSearchHitDTO `json:"users"`
	Page       int                 `json:"page"`
	PerPage    int                 `json:"perPage"`
}

type GetUserOrgListQuery struct {
	UserId int64
	Result []*UserOrgDTO
}

type UpdateUserLastSeenAtCommand struct {
	UserId int64
}

type UserProfileDTO struct {
	Id             int64           `json:"id"`
	Email          string          `json:"email"`
	Name           string          `json:"name"`
	Login          string          `json:"login"`
	Theme          string          `json:"theme"`
	OrgId          int64           `json:"orgId,omitempty"`
	IsGrafanaAdmin bool            `json:"isGrafanaAdmin"`
	IsDisabled     bool            `json:"isDisabled"`
	IsExternal     bool            `json:"isExternal"`
	AuthLabels     []string        `json:"authLabels"`
	UpdatedAt      time.Time       `json:"updatedAt"`
	CreatedAt      time.Time       `json:"createdAt"`
	AvatarUrl      string          `json:"avatarUrl"`
	AccessControl  map[string]bool `json:"accessControl,omitempty"`
}

type UserSearchHitDTO struct {
	Id            int64                `json:"id"`
	Name          string               `json:"name"`
	Login         string               `json:"login"`
	Email         string               `json:"email"`
	AvatarUrl     string               `json:"avatarUrl"`
	IsAdmin       bool                 `json:"isAdmin"`
	IsDisabled    bool                 `json:"isDisabled"`
	LastSeenAt    time.Time            `json:"lastSeenAt"`
	LastSeenAtAge string               `json:"lastSeenAtAge"`
	AuthLabels    []string             `json:"authLabels"`
	AuthModule    AuthModuleConversion `json:"-"`
}

type UserIdDTO struct {
	Id      int64  `json:"id"`
	Message string `json:"message"`
}

// implement Conversion interface to define custom field mapping (xorm feature)
type AuthModuleConversion []string

func (auth *AuthModuleConversion) FromDB(data []byte) error {
	auth_module := string(data)
	*auth = []string{auth_module}
	return nil
}

// Just a stub, we don't want to write to database
func (auth *AuthModuleConversion) ToDB() ([]byte, error) {
	return []byte{}, nil
}
