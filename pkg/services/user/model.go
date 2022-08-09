package user

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

type HelpFlags1 uint64

// Typed errors
var (
	ErrCaseInsensitive   = errors.New("case insensitive conflict")
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrLastGrafanaAdmin  = errors.New("cannot remove last grafana admin")
	ErrProtectedUser     = errors.New("cannot adopt protected user")
)

type User struct {
	ID            int64 `xorm:"pk autoincr 'id'"`
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
	HelpFlags1    HelpFlags1
	IsDisabled    bool

	IsAdmin          bool
	IsServiceAccount bool
	OrgID            int64 `xorm:"org_id"`

	Created    time.Time
	Updated    time.Time
	LastSeenAt time.Time
}

type CreateUserCommand struct {
	Email            string
	Login            string
	Name             string
	Company          string
	OrgID            int64
	OrgName          string
	Password         string
	EmailVerified    bool
	IsAdmin          bool
	IsDisabled       bool
	SkipOrgSetup     bool
	DefaultOrgRole   string
	IsServiceAccount bool
}

type GetUserByLoginQuery struct {
	LoginOrEmail string
}

type GetUserByEmailQuery struct {
	Email string
}

type UpdateUserCommand struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Login string `json:"login"`
	Theme string `json:"theme"`

	UserID int64 `json:"-"`
}

type ChangeUserPasswordCommand struct {
	OldPassword string `json:"oldPassword"`
	NewPassword string `json:"newPassword"`

	UserID int64 `json:"-"`
}

type UpdateUserLastSeenAtCommand struct {
	UserID int64
}

func (u *User) NameOrFallback() string {
	if u.Name != "" {
		return u.Name
	}
	if u.Login != "" {
		return u.Login
	}
	return u.Email
}

type DeleteUserCommand struct {
	UserID int64
}

type GetUserByIDQuery struct {
	ID int64
}

type ErrCaseInsensitiveLoginConflict struct {
	Users []User
}

func (e *ErrCaseInsensitiveLoginConflict) Unwrap() error {
	return ErrCaseInsensitive
}

func (e *ErrCaseInsensitiveLoginConflict) Error() string {
	n := len(e.Users)

	userStrings := make([]string, 0, n)
	for _, v := range e.Users {
		userStrings = append(userStrings, fmt.Sprintf("%s (email:%s, id:%d)", v.Login, v.Email, v.ID))
	}

	return fmt.Sprintf(
		"Found a conflict in user login information. %d users already exist with either the same login or email: [%s].",
		n, strings.Join(userStrings, ", "))
}
