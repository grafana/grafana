package models

import (
	"time"

	"golang.org/x/oauth2"
)

const (
	AuthModuleLDAP = "ldap"
)

type UserAuth struct {
	Id                int64
	UserId            int64
	AuthModule        string
	AuthId            string
	Created           time.Time
	OAuthAccessToken  string
	OAuthRefreshToken string
	OAuthTokenType    string
	OAuthExpiry       time.Time
}

type ExternalUserInfo struct {
	OAuthToken     *oauth2.Token
	AuthModule     string
	AuthId         string
	UserId         int64
	Email          string
	Login          string
	Name           string
	Groups         []string
	OrgRoles       map[int64]RoleType
	IsGrafanaAdmin *bool // This is a pointer to know if we should sync this or not (nil = ignore sync)
	IsDisabled     bool
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
	OAuthToken *oauth2.Token
}

type UpdateAuthInfoCommand struct {
	AuthModule string
	AuthId     string
	UserId     int64
	OAuthToken *oauth2.Token
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

type GetExternalUserInfoByLoginQuery struct {
	LoginOrEmail string

	Result *ExternalUserInfo
}

type GetAuthInfoQuery struct {
	UserId     int64
	AuthModule string
	AuthId     string

	Result *UserAuth
}

type TeamOrgGroupDTO struct {
	TeamName string `json:"teamName"`
	OrgName  string `json:"orgName"`
	GroupDN  string `json:"groupDN"`
}

type GetTeamsForLDAPGroupCommand struct {
	Groups []string
	Result []TeamOrgGroupDTO
}

type SyncTeamsCommand struct {
	ExternalUser *ExternalUserInfo
	User         *User
}
