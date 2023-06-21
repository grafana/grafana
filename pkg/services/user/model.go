package user

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models/roletype"
)

type HelpFlags1 uint64

func (f HelpFlags1) HasFlag(flag HelpFlags1) bool { return f&flag != 0 }
func (f *HelpFlags1) AddFlag(flag HelpFlags1)     { *f |= flag }

const (
	HelpFlagGettingStartedPanelDismissed HelpFlags1 = 1 << iota
	HelpFlagDashboardHelp1
)

// Typed errors
var (
	ErrCaseInsensitive   = errors.New("case insensitive conflict")
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrLastGrafanaAdmin  = errors.New("cannot remove last grafana admin")
	ErrProtectedUser     = errors.New("cannot adopt protected user")
	ErrNoUniqueID        = errors.New("identifying id not found")
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

type SetUsingOrgCommand struct {
	UserID int64
	OrgID  int64
}

type SearchUsersQuery struct {
	SignedInUser *SignedInUser
	OrgID        int64 `xorm:"org_id"`
	Query        string
	Page         int
	Limit        int
	AuthModule   string
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
	ID                 int64           `json:"id"`
	Email              string          `json:"email"`
	Name               string          `json:"name"`
	Login              string          `json:"login"`
	Theme              string          `json:"theme"`
	OrgID              int64           `json:"orgId,omitempty"`
	IsGrafanaAdmin     bool            `json:"isGrafanaAdmin"`
	IsDisabled         bool            `json:"isDisabled"`
	IsExternal         bool            `json:"isExternal"`
	IsExternallySynced bool            `json:"isExternallySynced"`
	AuthLabels         []string        `json:"authLabels"`
	UpdatedAt          time.Time       `json:"updatedAt"`
	CreatedAt          time.Time       `json:"createdAt"`
	AvatarURL          string          `json:"avatarUrl"`
	AccessControl      map[string]bool `json:"accessControl,omitempty"`
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

type DisableUserCommand struct {
	UserID     int64 `xorm:"user_id"`
	IsDisabled bool
}

type BatchDisableUsersCommand struct {
	UserIDs    []int64 `xorm:"user_ids"`
	IsDisabled bool
}

type SetUserHelpFlagCommand struct {
	HelpFlags1 HelpFlags1
	UserID     int64 `xorm:"user_id"`
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

type SignedInUser struct {
	UserID           int64 `xorm:"user_id"`
	OrgID            int64 `xorm:"org_id"`
	OrgName          string
	OrgRole          roletype.RoleType
	Login            string
	Name             string
	Email            string
	ApiKeyID         int64 `xorm:"api_key_id"`
	IsServiceAccount bool  `xorm:"is_service_account"`
	OrgCount         int
	IsGrafanaAdmin   bool
	IsAnonymous      bool
	IsDisabled       bool
	HelpFlags1       HelpFlags1
	LastSeenAt       time.Time
	Teams            []int64
	// Permissions grouped by orgID and actions
	Permissions map[int64]map[string][]string `json:"-"`
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

type UserDisplayDTO struct {
	ID        int64  `json:"id,omitempty"`
	Name      string `json:"name,omitempty"`
	Login     string `json:"login,omitempty"`
	AvatarURL string `json:"avatarUrl"`
}

// ------------------------
// DTO & Projections

func (u *SignedInUser) ShouldUpdateLastSeenAt() bool {
	return u.UserID > 0 && time.Since(u.LastSeenAt) > time.Minute*5
}

func (u *SignedInUser) NameOrFallback() string {
	if u.Name != "" {
		return u.Name
	}
	if u.Login != "" {
		return u.Login
	}
	return u.Email
}

func (u *SignedInUser) ToUserDisplayDTO() *UserDisplayDTO {
	return &UserDisplayDTO{
		ID:    u.UserID,
		Login: u.Login,
		Name:  u.Name,
	}
}

func (u *SignedInUser) HasRole(role roletype.RoleType) bool {
	if u.IsGrafanaAdmin {
		return true
	}

	return u.OrgRole.Includes(role)
}

// IsRealUser returns true if the user is a real user and not a service account
func (u *SignedInUser) IsRealUser() bool {
	// backwards compatibility
	// checking if userId the user is a real user
	// previously we used to check if the UserId was 0 or -1
	// and not a service account
	return u.UserID > 0 && !u.IsServiceAccountUser()
}

func (u *SignedInUser) IsApiKeyUser() bool {
	return u.ApiKeyID > 0
}

// IsServiceAccountUser returns true if the user is a service account
func (u *SignedInUser) IsServiceAccountUser() bool {
	return u.IsServiceAccount
}

func (u *SignedInUser) HasUniqueId() bool {
	return u.IsRealUser() || u.IsApiKeyUser() || u.IsServiceAccountUser()
}

func (u *SignedInUser) GetCacheKey() (string, error) {
	if u.IsRealUser() {
		return fmt.Sprintf("%d-user-%d", u.OrgID, u.UserID), nil
	}
	if u.IsApiKeyUser() {
		return fmt.Sprintf("%d-apikey-%d", u.OrgID, u.ApiKeyID), nil
	}
	if u.IsServiceAccountUser() { // not considered a real user
		return fmt.Sprintf("%d-service-%d", u.OrgID, u.UserID), nil
	}
	return "", ErrNoUniqueID
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

type Filter interface {
	WhereCondition() *WhereCondition
	InCondition() *InCondition
	JoinCondition() *JoinCondition
}

type WhereCondition struct {
	Condition string
	Params    interface{}
}

type InCondition struct {
	Condition string
	Params    interface{}
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
	Message string `json:"message"`
}

type Password string

func (p Password) IsWeak() bool {
	return len(p) <= 4
}
