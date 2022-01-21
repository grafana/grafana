package models

import (
	"errors"
	"time"
)

var (
	ErrApiKeyNotFound          = errors.New("API key not found")
	ErrInvalidApiKey           = errors.New("invalid API key")
	ErrInvalidApiKeyExpiration = errors.New("negative value for SecondsToLive")
	ErrDuplicateApiKey         = errors.New("API key, organization ID and name must be unique")
)

type ApiKey struct {
	Id               int64
	OrgId            int64
	Name             string
	Key              string
	Role             RoleType
	Created          time.Time
	Updated          time.Time
	Expires          *int64
	ServiceAccountId int64
}

// ---------------------
// COMMANDS
type AddApiKeyCommand struct {
	Name             string   `json:"name" binding:"Required"`
	Role             RoleType `json:"role" binding:"Required"`
	OrgId            int64    `json:"-"`
	Key              string   `json:"-"`
	SecondsToLive    int64    `json:"secondsToLive"`
	ServiceAccountId int64    `json:"-"`
	Result           *ApiKey  `json:"-"`
}

type DeleteApiKeyCommand struct {
	Id    int64 `json:"id"`
	OrgId int64 `json:"-"`
}

// ----------------------
// QUERIES

type GetApiKeysQuery struct {
	OrgId          int64
	IncludeExpired bool
	Result         []*ApiKey
}

type GetApiKeyByNameQuery struct {
	KeyName string
	OrgId   int64
	Result  *ApiKey
}

type GetApiKeyByIdQuery struct {
	ApiKeyId int64
	Result   *ApiKey
}

// ------------------------
// DTO & Projections

type ApiKeyDTO struct {
	Id         int64      `json:"id"`
	Name       string     `json:"name"`
	Role       RoleType   `json:"role"`
	Expiration *time.Time `json:"expiration,omitempty"`
}
