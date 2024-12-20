package serviceaccounts

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

var (
	ScopeAll = "serviceaccounts:*"
	ScopeID  = accesscontrol.Scope("serviceaccounts", "id", accesscontrol.Parameter(":serviceAccountId"))
)

const (
	ServiceAccountPrefix = "sa-"
	ExtSvcPrefix         = "extsvc-"
)

const (
	ActionRead             = "serviceaccounts:read"
	ActionWrite            = "serviceaccounts:write"
	ActionCreate           = "serviceaccounts:create"
	ActionDelete           = "serviceaccounts:delete"
	ActionPermissionsRead  = "serviceaccounts.permissions:read"
	ActionPermissionsWrite = "serviceaccounts.permissions:write"
)

var (
	ErrServiceAccountNotFound            = errutil.NotFound("serviceaccounts.ErrNotFound", errutil.WithPublicMessage("service account not found"))
	ErrServiceAccountInvalidRole         = errutil.BadRequest("serviceaccounts.ErrInvalidRoleSpecified", errutil.WithPublicMessage("invalid role specified"))
	ErrServiceAccountRolePrivilegeDenied = errutil.Forbidden("serviceaccounts.ErrRoleForbidden", errutil.WithPublicMessage("can not assign a role higher than user's role"))
	ErrServiceAccountInvalidOrgID        = errutil.BadRequest("serviceaccounts.ErrInvalidOrgId", errutil.WithPublicMessage("invalid org id specified"))
	ErrServiceAccountInvalidID           = errutil.BadRequest("serviceaccounts.ErrInvalidId", errutil.WithPublicMessage("invalid service account id specified"))
	ErrServiceAccountInvalidAPIKeyID     = errutil.BadRequest("serviceaccounts.ErrInvalidAPIKeyId", errutil.WithPublicMessage("invalid api key id specified"))
	ErrServiceAccountInvalidTokenID      = errutil.BadRequest("serviceaccounts.ErrInvalidTokenId", errutil.WithPublicMessage("invalid service account token id specified"))
	ErrServiceAccountAlreadyExists       = errutil.BadRequest("serviceaccounts.ErrAlreadyExists", errutil.WithPublicMessage("service account already exists"))
	ErrServiceAccountTokenNotFound       = errutil.NotFound("serviceaccounts.ErrTokenNotFound", errutil.WithPublicMessage("service account token not found"))
	ErrInvalidTokenExpiration            = errutil.ValidationFailed("serviceaccounts.ErrInvalidInput", errutil.WithPublicMessage("invalid SecondsToLive value"))
	ErrDuplicateToken                    = errutil.BadRequest("serviceaccounts.ErrTokenAlreadyExists", errutil.WithPublicMessage("service account token with given name already exists in the organization"))
)

type MigrationResult struct {
	Total           int      `json:"total"`
	Migrated        int      `json:"migrated"`
	Failed          int      `json:"failed"`
	FailedApikeyIDs []int64  `json:"failedApikeyIDs"`
	FailedDetails   []string `json:"failedDetails"`
}

// swagger:model
type CreateServiceAccountForm struct {
	// example: grafana
	Name string `json:"name" binding:"Required"`
	// example: Admin
	Role *org.RoleType `json:"role"`
	// example: false
	IsDisabled *bool `json:"isDisabled"`
}

// swagger:model
type UpdateServiceAccountForm struct {
	Name             *string       `json:"name"`
	ServiceAccountID int64         `json:"serviceAccountId"`
	Role             *org.RoleType `json:"role"`
	IsDisabled       *bool         `json:"isDisabled"`
}

// swagger: model
type ServiceAccountDTO struct {
	Id int64 `json:"id" xorm:"user_id"`
	// example: fe1xejlha91xce
	UID string `json:"uid" xorm:"uid"`
	// example: grafana
	Name string `json:"name" xorm:"name"`
	// example: sa-grafana
	Login string `json:"login" xorm:"login"`
	// example: 1
	OrgId int64 `json:"orgId" xorm:"org_id"`
	// example: false
	IsDisabled bool `json:"isDisabled" xorm:"is_disabled"`
	// example: false
	IsExternal bool `json:"isExternal,omitempty" xorm:"-"`
	// example: Viewer
	Role string `json:"role" xorm:"role"`
	// example: 0
	Tokens int64 `json:"tokens"`
	// example: /avatar/85ec38023d90823d3e5b43ef35646af9
	AvatarUrl string `json:"avatarUrl"`
	// example: {"serviceaccounts:delete": true, "serviceaccounts:read": true, "serviceaccounts:write": true}
	AccessControl map[string]bool `json:"accessControl,omitempty"`
}

type GetSATokensQuery struct {
	OrgID            *int64 // optional filtering by org ID
	ServiceAccountID *int64 // optional filtering by service account ID
}

type GetServiceAccountQuery struct {
	OrgID int64  `json:"orgId"`
	ID    int64  `json:"id"`
	UID   string `json:"uid"`
}

type AddServiceAccountTokenCommand struct {
	Name          string `json:"name" binding:"Required"`
	OrgId         int64  `json:"-"`
	Key           string `json:"-"`
	SecondsToLive int64  `json:"secondsToLive"`
}

type SearchOrgServiceAccountsQuery struct {
	OrgID        int64
	Query        string
	Filter       ServiceAccountFilter
	Page         int
	Limit        int
	CountOnly    bool
	CountTokens  bool
	SignedInUser identity.Requester
}

func (q *SearchOrgServiceAccountsQuery) SetDefaults() {
	q.Page = 1
	q.Limit = 100
}

// swagger: model
type SearchOrgServiceAccountsResult struct {
	// It can be used for pagination of the user list
	// E.g. if totalCount is equal to 100 users and
	// the perpage parameter is set to 10 then there are 10 pages of users.
	TotalCount      int64                `json:"totalCount"`
	ServiceAccounts []*ServiceAccountDTO `json:"serviceAccounts"`
	Page            int                  `json:"page"`
	PerPage         int                  `json:"perPage"`
}

// swagger:model
type ServiceAccountProfileDTO struct {
	// example: 2
	Id int64 `json:"id" xorm:"user_id"`
	// example: fe1xejlha91xce
	UID string `json:"uid" xorm:"uid"`
	// example: test
	Name string `json:"name" xorm:"name"`
	// example: sa-grafana
	Login string `json:"login" xorm:"login"`
	// example: 1
	OrgId int64 `json:"orgId" xorm:"org_id"`
	// example: false
	IsDisabled bool `json:"isDisabled" xorm:"is_disabled"`
	// example: 2022-03-21T14:35:33Z
	Created time.Time `json:"createdAt" xorm:"created"`
	// example: 2022-03-21T14:35:33Z
	Updated time.Time `json:"updatedAt" xorm:"updated"`
	// example: /avatar/8ea890a677d6a223c591a1beea6ea9d2
	AvatarUrl string `json:"avatarUrl" xorm:"-"`
	// example: Editor
	Role string `json:"role" xorm:"role"`
	// example: []
	Teams []string `json:"teams" xorm:"-"`
	// example: false
	IsExternal bool `json:"isExternal,omitempty" xorm:"-"`
	// example: grafana-app
	RequiredBy string `json:"requiredBy,omitempty" xorm:"-"`

	Tokens        int64           `json:"tokens,omitempty"`
	AccessControl map[string]bool `json:"accessControl,omitempty" xorm:"-"`
}

type ServiceAccountFilter string // used for filtering

const (
	FilterOnlyExpiredTokens ServiceAccountFilter = "expiredTokens"
	FilterOnlyDisabled      ServiceAccountFilter = "disabled"
	FilterIncludeAll        ServiceAccountFilter = "all"
	FilterOnlyExternal      ServiceAccountFilter = "external"
)

type Stats struct {
	ServiceAccounts           int64 `xorm:"serviceaccounts"`
	ServiceAccountsWithNoRole int64 `xorm:"serviceaccounts_with_no_role"`
	Tokens                    int64 `xorm:"serviceaccount_tokens"`
	ForcedExpiryEnabled       bool  `xorm:"-"`
}

// ExtSvcAccount represents the service account associated to an external service
type ExtSvcAccount struct {
	ID         int64
	Login      string
	Name       string
	OrgID      int64
	IsDisabled bool
	Role       identity.RoleType
}

type ManageExtSvcAccountCmd struct {
	ExtSvcSlug  string
	Enabled     bool
	OrgID       int64
	Permissions []accesscontrol.Permission
}

type EnableExtSvcAccountCmd struct {
	ExtSvcSlug string
	Enabled    bool
	OrgID      int64
}

// AccessEvaluator is used to protect the "Configuration > Service accounts" page access
var AccessEvaluator = accesscontrol.EvalAny(
	accesscontrol.EvalPermission(ActionRead),
	accesscontrol.EvalPermission(ActionCreate),
)

func ExtSvcLoginPrefix(orgID int64) string {
	return fmt.Sprintf("%s%d-%s", ServiceAccountPrefix, orgID, ExtSvcPrefix)
}

func IsExternalServiceAccount(login string) bool {
	parts := strings.SplitAfter(login, "-")
	if len(parts) < 4 {
		return false
	}

	return parts[0] == ServiceAccountPrefix && parts[2] == ExtSvcPrefix
}
