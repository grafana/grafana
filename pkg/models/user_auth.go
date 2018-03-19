package models

import (
	"time"
)

type UserAuth struct {
	Id         int64
	UserId     int64
	AuthModule string
	AuthId     string
	Created    time.Time
}

type ExternalUserInfo struct {
	AuthModule string
	AuthId     string
	UserId     int64
	Email      string
	Login      string
	Name       string
	OrgRoles   map[int64]RoleType
}

// ---------------------
// COMMANDS

type UpsertUserCommand struct {
	ExternalUser  *ExternalUserInfo
	SignupAllowed bool

	User *User
}

type SetAuthInfoCommand struct {
	AuthModule string
	AuthId     string
	UserId     int64
}

type DeleteAuthInfoCommand struct {
	UserAuth *UserAuth
}

// ----------------------
// QUERIES

type LoginUserQuery struct {
	Username  string
	Password  string
	User      *User
	IpAddress string
}

type GetUserByAuthInfoQuery struct {
	AuthModule string
	AuthId     string
	UserId     int64
	Email      string
	Login      string

	User     *User
	UserAuth *UserAuth
}

type GetAuthInfoQuery struct {
	AuthModule string
	AuthId     string

	UserAuth *UserAuth
}
