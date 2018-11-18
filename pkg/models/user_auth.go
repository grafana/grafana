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
	AuthModule     string
	AuthId         string
	UserId         int64
	Email          string
	Login          string
	Name           string
	Groups         []string
	OrgRoles       map[int64]RoleType
	IsGrafanaAdmin *bool // This is a pointer to know if we should sync this or not (nil = ignore sync)
}

// ---------------------
// COMMANDS

type UpsertUserCommand struct {
	ReqContext    *ReqContext
	ExternalUser  *ExternalUserInfo
	SignupAllowed bool

	Result *User
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
	ReqContext *ReqContext
	Username   string
	Password   string
	User       *User
	IpAddress  string
}

type GetUserByAuthInfoQuery struct {
	AuthModule string
	AuthId     string
	UserId     int64
	Email      string
	Login      string

	Result *User
}

type GetAuthInfoQuery struct {
	AuthModule string
	AuthId     string

	Result *UserAuth
}

type SyncTeamsCommand struct {
	ExternalUser *ExternalUserInfo
	User         *User
}
