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
	Id       int64
	Version  int
	Email    string
	Name     string
	Login    string
	Password string
	Salt     string
	Rands    string
	Company  string

	IsAdmin   bool
	AccountId int64

	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type CreateUserCommand struct {
	Email    string `json:"email" binding:"Required"`
	Login    string `json:"login"`
	Name     string `json:"name"`
	Company  string `json:"compay"`
	Password string `json:"password" binding:"Required"`
	IsAdmin  bool   `json:"-"`

	Result User `json:"-"`
}

type UpdateUserCommand struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Login string `json:"login"`

	UserId int64 `json:"-"`
}

type SetUsingAccountCommand struct {
	UserId    int64
	AccountId int64
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
	Result *SignedInUser
}

type GetUserInfoQuery struct {
	UserId int64
	Result UserDTO
}

type SearchUsersQuery struct {
	Query string
	Page  int
	Limit int

	Result []*UserSearchHitDTO
}

// ------------------------
// DTO & Projections

type SignedInUser struct {
	UserId         int64
	AccountId      int64
	AccountName    string
	AccountRole    RoleType
	Login          string
	Name           string
	Email          string
	ApiKeyId       int64
	IsGrafanaAdmin bool
}

type UserDTO struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Login string `json:"login"`
}

type UserSearchHitDTO struct {
	Id      int64  `json:"id"`
	Name    string `json:"name"`
	Login   string `json:"login"`
	Email   string `json:"email"`
	IsAdmin bool   `json:"isAdmin"`
}
