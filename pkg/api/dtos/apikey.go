package dtos

import "github.com/grafana/grafana/pkg/models"

type AddApiKeyCommand struct {
	Name          string          `json:"name" binding:"Required"`
	Role          models.RoleType `json:"role" binding:"Required"`
	SecondsToLive int64           `json:"secondsToLive"`
}

type AddApiKeyForOrgCommand struct {
	Name          string          `json:"name" binding:"Required"`
	Role          models.RoleType `json:"role" binding:"Required"`
	OrgId         int64           `json:"orgId" binding:"Required"`
	SecondsToLive int64           `json:"secondsToLive"`
}

type NewApiKeyResult struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Key  string `json:"key"`
}
