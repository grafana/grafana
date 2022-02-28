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
	ActionRead   = "serviceaccounts:read"
	ActionWrite  = "serviceaccounts:write"
	ActionCreate = "serviceaccounts:create"
	ActionDelete = "serviceaccounts:delete"
)

type ServiceAccount struct {
	Id int64
}

type UpdateServiceAccountForm struct {
	Name *string          `json:"name"`
	Role *models.RoleType `json:"role"`
}

type CreateServiceAccountForm struct {
	OrgID int64  `json:"-"`
	Name  string `json:"name" binding:"Required"`
}

type ServiceAccountDTO struct {
	Id            int64           `json:"id"`
	Name          string          `json:"name"`
	Login         string          `json:"login"`
	OrgId         int64           `json:"orgId"`
	Tokens        int64           `json:"tokens"`
	Role          string          `json:"role"`
	AvatarUrl     string          `json:"avatarUrl"`
	AccessControl map[string]bool `json:"accessControl,omitempty"`
}

type ServiceAccountProfileDTO struct {
	Id            int64           `json:"id"`
	Name          string          `json:"name"`
	Login         string          `json:"login"`
	OrgId         int64           `json:"orgId"`
	IsDisabled    bool            `json:"isDisabled"`
	UpdatedAt     time.Time       `json:"updatedAt"`
	CreatedAt     time.Time       `json:"createdAt"`
	AvatarUrl     string          `json:"avatarUrl"`
	Role          string          `json:"role"`
	Teams         []string        `json:"teams"`
	AccessControl map[string]bool `json:"accessControl,omitempty"`
}
