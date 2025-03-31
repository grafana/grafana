package login

import (
	"fmt"
	"time"

	"golang.org/x/oauth2"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type UserAuth struct {
	Id                int64
	UserId            int64
	AuthModule        string
	AuthId            string
	Created           time.Time
	OAuthAccessToken  string
	OAuthRefreshToken string
	OAuthIdToken      string
	OAuthTokenType    string
	OAuthExpiry       time.Time
	ExternalUID       string `xorm:"external_uid"`
}

type ExternalUserInfo struct {
	OAuthToken     *oauth2.Token
	SAMLSession    *SAMLSession
	AuthModule     string
	AuthId         string
	UserId         int64
	Email          string
	Login          string
	Name           string
	Groups         []string
	OrgRoles       map[int64]org.RoleType
	IsGrafanaAdmin *bool // This is a pointer to know if we should sync this or not (nil = ignore sync)
	IsDisabled     bool
	SkipTeamSync   bool
}

type SAMLSession struct {
	NameID       string
	SessionIndex string
}

func (e *ExternalUserInfo) String() string {
	isGrafanaAdmin := "nil"
	if e.IsGrafanaAdmin != nil {
		isGrafanaAdmin = fmt.Sprintf("%v", *e.IsGrafanaAdmin)
	}
	return fmt.Sprintf("OAuthToken: %+v, AuthModule: %v, AuthId: %v, UserId: %v, Email: %v, Login: %v, Name: %v, Groups: %v, OrgRoles: %v, IsGrafanaAdmin: %v, IsDisabled: %v, SkipTeamSync: %v",
		e.OAuthToken, e.AuthModule, e.AuthId, e.UserId, e.Email, e.Login, e.Name, e.Groups, e.OrgRoles, isGrafanaAdmin, e.IsDisabled, e.SkipTeamSync)
}

type LoginInfo struct {
	AuthModule    string
	User          *user.User
	ExternalUser  ExternalUserInfo
	LoginUsername string
	HTTPStatus    int
	Error         error
}

// RequestURIKey is used as key to save request URI in contexts
// (used for the Enterprise auditing feature)
type RequestURIKey struct{}

// ---------------------
// COMMANDS

type SetAuthInfoCommand struct {
	AuthModule  string
	AuthId      string
	UserId      int64
	OAuthToken  *oauth2.Token
	ExternalUID string
}

type UpdateAuthInfoCommand struct {
	AuthModule  string
	AuthId      string
	UserId      int64
	OAuthToken  *oauth2.Token
	ExternalUID string
}

type DeleteAuthInfoCommand struct {
	UserAuth *UserAuth
}

// ----------------------
// QUERIES

type LoginUserQuery struct {
	ReqContext *contextmodel.ReqContext
	Username   string
	Password   string
	User       *user.User
	IpAddress  string
	AuthModule string
	Cfg        *setting.Cfg
}

type GetUserByAuthInfoQuery struct {
	AuthModule string
	AuthId     string
	UserLookupParams
}

type UserLookupParams struct {
	// Describes lookup order as well
	Email *string // if set, will try to find the user by email
	Login *string // if set, will try to find the user by login
}

type GetAuthInfoQuery struct {
	UserId     int64
	AuthModule string
	AuthId     string
}

type GetUserLabelsQuery struct {
	UserIDs []int64
}
