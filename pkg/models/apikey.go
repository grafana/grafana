package models

import (
	"errors"
	"time"
)

var ErrInvalidApiKey = errors.New("Invalid API Key")

type ApiKey struct {
	Id      int64
	OrgId   int64
	Name    string
	Key     string
	Role    RoleType
	IsAdmin bool
	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS
type AddApiKeyCommand struct {
	Name    string   `json:"name" binding:"Required"`
	Role    RoleType `json:"role" binding:"Required"`
	OrgId   int64    `json:"-"`
	Key     string   `json:"-"`
	IsAdmin bool     `json:"isAdmin"`

	Result *ApiKey `json:"-"`
}

type DeleteApiKeyCommand struct {
	Id    int64 `json:"id"`
	OrgId int64 `json:"-"`
}

// ----------------------
// QUERIES

type GetApiKeysQuery struct {
	OrgId  int64
	Result []*ApiKey
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
	Id   int64    `json:"id"`
	Name string   `json:"name"`
	Role RoleType `json:"role"`
}
