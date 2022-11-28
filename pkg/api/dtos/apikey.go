package dtos

import (
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

// swagger:model
type NewApiKeyResult struct {
	// example: 1
	ID int64 `json:"id"`
	// example: grafana
	Name string `json:"name"`
	// example: glsa_yscW25imSKJIuav8zF37RZmnbiDvB05G_fcaaf58a
	Key string `json:"key"`
}

type ApiKeyDTO struct {
	Id            int64                  `json:"id"`
	Name          string                 `json:"name"`
	Role          org.RoleType           `json:"role"`
	Expiration    *time.Time             `json:"expiration,omitempty"`
	AccessControl accesscontrol.Metadata `json:"accessControl,omitempty"`
}

// @PERCONA
type ApiKey struct {
	Id               int64
	OrgId            int64
	Name             string
	Key              string
	Role             org.RoleType
	Created          time.Time
	Updated          time.Time
	LastUsedAt       *time.Time `xorm:"last_used_at"`
	Expires          *int64
	ServiceAccountId *int64
}

type GetApiKeyByIdQuery struct {
	ApiKeyId int64
	Result   *ApiKey
}

type ApiKeyDetailsDTO struct {
	Id         int64        `json:"id"`
	OrgId      int64        `json:"orgId,omitempty"`
	Name       string       `json:"name"`
	Role       org.RoleType `json:"role"`
	Expiration *time.Time   `json:"expiration,omitempty"`
}

type GetApiKeyByNameQuery struct {
	KeyName string
	OrgId   int64
	Result  *ApiKey
}
