package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrUserNotFound = errors.New("User not found")
)

type User struct {
	Id            int64
	Version       int
	Email         string
	Name          string
	Login         string
	Password      string
	Salt          string
	Rands         string
	Company       string
	EmailVerified bool
	Theme         string

	IsAdmin bool
	OrgId   int64

	Created time.Time
	Updated time.Time
}

func (u *User) NameOrFallback() string {
	if u.Name != "" {
		return u.Name
	} else if u.Login != "" {
		return u.Login
	} else {
		return u.Email
	}
}

// ---------------------
// COMMANDS

type CreateUserCommand struct {
	Email         string
	Login         string
	Name          string
	Company       string
	OrgName       string
	Password      string
	EmailVerified bool
	IsAdmin       bool
<<<<<<< 480b120d4e1187bc8acaa8d22f3daffed4cb5a49
	SkipOrgSetup  bool
=======
>>>>>>> feat(signup): almost done with new sign up flow, #2353

	Result User
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

type UpdateUserPermissionsCommand struct {
	IsGrafanaAdmin bool
	UserId         int64 `json:"-"`
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
	Result       *User
}

type GetUserByIdQuery struct {
	Id     int64
	Result *User
}

type GetSignedInUserQuery struct {
	UserId int64
	Login  string
	Email  string
	Result *SignedInUser
}

type GetUserProfileQuery struct {
	UserId int64
	Result UserProfileDTO
}

type SearchUsersQuery struct {
	Query string
	Page  int
	Limit int

	Result []*UserSearchHitDTO
}

type GetUserOrgListQuery struct {
	UserId int64
	Result []*UserOrgDTO
}

// ------------------------
// DTO & Projections

type SignedInUser struct {
	UserId         int64
	OrgId          int64
	OrgName        string
	OrgRole        RoleType
	Login          string
	Name           string
	Email          string
	Theme          string
	ApiKeyId       int64
	IsGrafanaAdmin bool
}

type UserProfileDTO struct {
	Email          string `json:"email"`
	Name           string `json:"name"`
	Login          string `json:"login"`
	Theme          string `json:"theme"`
	OrgId          int64  `json:"orgId"`
	IsGrafanaAdmin bool   `json:"isGrafanaAdmin"`
}

type UserSearchHitDTO struct {
	Id      int64  `json:"id"`
	Name    string `json:"name"`
	Login   string `json:"login"`
	Email   string `json:"email"`
	IsAdmin bool   `json:"isAdmin"`
}
