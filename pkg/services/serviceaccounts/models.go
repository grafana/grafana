package serviceaccounts

import (
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var (
	ScopeAll = "serviceaccounts:*"
	ScopeID  = accesscontrol.Scope("serviceaccounts", "id", accesscontrol.Parameter(":serviceAccountId"))
)

const (
	ActionRead             = "serviceaccounts:read"
	ActionWrite            = "serviceaccounts:write"
	ActionCreate           = "serviceaccounts:create"
	ActionDelete           = "serviceaccounts:delete"
	ActionPermissionsRead  = "serviceaccounts.permissions:read"
	ActionPermissionsWrite = "serviceaccounts.permissions:write"
)

type ServiceAccount struct {
	Id int64
}

// swagger:model
type CreateServiceAccountForm struct {
	// example: grafana
	Name string `json:"name" binding:"Required"`
	// example: Admin
	Role *models.RoleType `json:"role"`
	// example: false
	IsDisabled *bool `json:"isDisabled"`
}

// swagger:model
type UpdateServiceAccountForm struct {
	Name       *string          `json:"name"`
	Role       *models.RoleType `json:"role"`
	IsDisabled *bool            `json:"isDisabled"`
}

// swagger: model
type ServiceAccountDTO struct {
	Id int64 `json:"id" xorm:"user_id"`
	// example: grafana
	Name string `json:"name" xorm:"name"`
	// example: sa-grafana
	Login string `json:"login" xorm:"login"`
	// example: 1
	OrgId int64 `json:"orgId" xorm:"org_id"`
	// example: false
	IsDisabled bool `json:"isDisabled" xorm:"is_disabled"`
	// example: Viewer
	Role string `json:"role" xorm:"role"`
	// example: 0
	Tokens int64 `json:"tokens"`
	// example: /avatar/85ec38023d90823d3e5b43ef35646af9
	AvatarUrl string `json:"avatarUrl"`
	// example: {"serviceaccounts:delete": true, "serviceaccounts:read": true, "serviceaccounts:write": true}
	AccessControl map[string]bool `json:"accessControl,omitempty"`
}

type AddServiceAccountTokenCommand struct {
	Name          string         `json:"name" binding:"Required"`
	OrgId         int64          `json:"-"`
	Key           string         `json:"-"`
	SecondsToLive int64          `json:"secondsToLive"`
	Result        *models.ApiKey `json:"-"`
}

// swagger: model
type SearchServiceAccountsResult struct {
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
	Teams         []string        `json:"teams" xorm:"-"`
	Tokens        int64           `json:"tokens,omitempty"`
	AccessControl map[string]bool `json:"accessControl,omitempty" xorm:"-"`
}

type ServiceAccountFilter string // used for filtering

type APIKeysMigrationStatus struct {
	Migrated bool `json:"migrated"`
}

const (
	FilterOnlyExpiredTokens ServiceAccountFilter = "expiredTokens"
	FilterOnlyDisabled      ServiceAccountFilter = "disabled"
	FilterIncludeAll        ServiceAccountFilter = "all"
)
