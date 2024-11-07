package user

import (
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/search/model"
)

type HelpFlags1 uint64

func (f HelpFlags1) HasFlag(flag HelpFlags1) bool { return f&flag != 0 }
func (f *HelpFlags1) AddFlag(flag HelpFlags1)     { *f |= flag }

const (
	HelpFlagGettingStartedPanelDismissed HelpFlags1 = 1 << iota
	HelpFlagDashboardHelp1
)

type UpdateEmailActionType string

const (
	EmailUpdateAction UpdateEmailActionType = "email-update"
	LoginUpdateAction UpdateEmailActionType = "login-update"
)

type User struct {
	ID            int64  `xorm:"pk autoincr 'id'"`
	UID           string `json:"uid" xorm:"uid"`
	Version       int
	Email         string
	Name          string
	Login         string
	Password      Password
	Salt          string
	Rands         string
	Company       string
	EmailVerified bool
	Theme         string
	HelpFlags1    HelpFlags1 `xorm:"help_flags1"`
	IsDisabled    bool

	IsAdmin          bool
	IsServiceAccount bool
	OrgID            int64 `xorm:"org_id"`

	Created    time.Time
	Updated    time.Time
	LastSeenAt time.Time
}

type CreateUserCommand struct {
	UID              string
	Email            string
	Login            string
	Name             string
	Company          string
	OrgID            int64
	OrgName          string
	Password         Password
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

	UserID         int64 `json:"-"`
	IsDisabled     *bool `json:"-"`
	EmailVerified  *bool `json:"-"`
	IsGrafanaAdmin *bool `json:"-"`
	// If password is included it will be validated, hashed and updated for user.
	Password *Password `json:"-"`
	// If old password is included it will be validated against users current password.
	OldPassword *Password `json:"-"`
	// If OrgID is included update current org for user
	OrgID      *int64      `json:"-"`
	HelpFlags1 *HelpFlags1 `json:"-"`
}

type UpdateUserLastSeenAtCommand struct {
	UserID int64
	OrgID  int64
}

type ListUserResult struct {
	Users      []*User
	ContinueID int64
	RV         int64
}

type SearchUsersQuery struct {
	SignedInUser identity.Requester
	OrgID        int64 `xorm:"org_id"`
	Query        string
	Page         int
	Limit        int
	AuthModule   string
	SortOpts     []model.SortOption
	Filters      []Filter

	IsDisabled *bool
}

type SearchUserQueryResult struct {
	TotalCount int64               `json:"totalCount"`
	Users      []*UserSearchHitDTO `json:"users"`
	Page       int                 `json:"page"`
	PerPage    int                 `json:"perPage"`
}

type UserSearchHitDTO struct {
	ID            int64                `json:"id" xorm:"id"`
	UID           string               `json:"uid" xorm:"uid"`
	Name          string               `json:"name"`
	Login         string               `json:"login"`
	Email         string               `json:"email"`
	AvatarURL     string               `json:"avatarUrl" xorm:"avatar_url"`
	IsAdmin       bool                 `json:"isAdmin"`
	IsDisabled    bool                 `json:"isDisabled"`
	LastSeenAt    time.Time            `json:"lastSeenAt"`
	LastSeenAtAge string               `json:"lastSeenAtAge"`
	AuthLabels    []string             `json:"authLabels"`
	AuthModule    AuthModuleConversion `json:"-"`
}

type GetUserProfileQuery struct {
	UserID int64
}

type UserProfileDTO struct {
	ID                             int64           `json:"id"`
	UID                            string          `json:"uid"`
	Email                          string          `json:"email"`
	Name                           string          `json:"name"`
	Login                          string          `json:"login"`
	Theme                          string          `json:"theme"`
	OrgID                          int64           `json:"orgId,omitempty"`
	IsGrafanaAdmin                 bool            `json:"isGrafanaAdmin"`
	IsDisabled                     bool            `json:"isDisabled"`
	IsExternal                     bool            `json:"isExternal"`
	IsExternallySynced             bool            `json:"isExternallySynced"`
	IsGrafanaAdminExternallySynced bool            `json:"isGrafanaAdminExternallySynced"`
	AuthLabels                     []string        `json:"authLabels"`
	UpdatedAt                      time.Time       `json:"updatedAt"`
	CreatedAt                      time.Time       `json:"createdAt"`
	AvatarURL                      string          `json:"avatarUrl"`
	AccessControl                  map[string]bool `json:"accessControl,omitempty"`
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

type BatchDisableUsersCommand struct {
	UserIDs    []int64 `xorm:"user_ids"`
	IsDisabled bool
}

type GetSignedInUserQuery struct {
	UserID int64 `xorm:"user_id"`
	Login  string
	Email  string
	OrgID  int64 `xorm:"org_id"`
}

type AnalyticsSettings struct {
	Identifier         string
	IntercomIdentifier string
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

type GetUserByUIDQuery struct {
	UID string
}

type StartVerifyEmailCommand struct {
	User   User
	Email  string
	Action UpdateEmailActionType
}

type CompleteEmailVerifyCommand struct {
	User identity.Requester
	Code string
}

type Filter interface {
	WhereCondition() *WhereCondition
	InCondition() *InCondition
	JoinCondition() *JoinCondition
}

type WhereCondition struct {
	Condition string
	Params    any
}

type InCondition struct {
	Condition string
	Params    any
}

type JoinCondition struct {
	Operator string
	Table    string
	Params   string
}

type SearchUserFilter interface {
	GetFilter(filterName string, params []string) Filter
	GetFilterList() map[string]FilterHandler
}

type FilterHandler func(params []string) (Filter, error)

const (
	QuotaTargetSrv string = "user"
	QuotaTarget    string = "user"
)

type AdminCreateUserResponse struct {
	ID      int64  `json:"id"`
	UID     string `json:"uid"`
	Message string `json:"message"`
}

type ChangeUserPasswordCommand struct {
	OldPassword Password `json:"oldPassword"`
	NewPassword Password `json:"newPassword"`
}
