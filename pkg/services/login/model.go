package login

import (
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/oauth2"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type LoginStats struct {
	DuplicateUserEntries int `xorm:"duplicate_user_entries"`
	MixedCasedUsers      int `xorm:"mixed_cased_users"`
}

const (
	ExporterName              = "grafana"
	MetricsCollectionInterval = time.Hour * 4 // every 4 hours, indication of duplicate users
)

var (
	// MStatDuplicateUserEntries is a indication metric gauge for number of users with duplicate emails or logins
	MStatDuplicateUserEntries prometheus.Gauge

	// MStatHasDuplicateEntries is a metric for if there is duplicate users
	MStatHasDuplicateEntries prometheus.Gauge

	// MStatMixedCasedUsers is a metric for if there is duplicate users
	MStatMixedCasedUsers prometheus.Gauge

	Once        sync.Once
	Initialised bool = false
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
	OrgRoles       map[int64]org.RoleType
	IsGrafanaAdmin *bool // This is a pointer to know if we should sync this or not (nil = ignore sync)
	IsDisabled     bool
	SkipTeamSync   bool
}

func (e *ExternalUserInfo) String() string {
	return fmt.Sprintf("%+v", *e)
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

type UpsertUserCommand struct {
	ReqContext   *contextmodel.ReqContext
	ExternalUser *ExternalUserInfo
	UserLookupParams
	SignupAllowed bool
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
	UserID *int64  // if set, will try to find the user by id
	Email  *string // if set, will try to find the user by email
	Login  *string // if set, will try to find the user by login
}

type GetExternalUserInfoByLoginQuery struct {
	LoginOrEmail string
}

type GetAuthInfoQuery struct {
	UserId     int64
	AuthModule string
	AuthId     string
}

type GetUserLabelsQuery struct {
	UserIDs []int64
}
