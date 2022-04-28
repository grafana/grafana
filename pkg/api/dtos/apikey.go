package dtos

import (
	"time"

	"github.com/grafana/grafana/pkg/models"
)

type NewApiKeyResult struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Key  string `json:"key"`
}

type ApiKeyDTO struct {
	Id         int64           `json:"id"`
	Name       string          `json:"name"`
	Role       models.RoleType `json:"role"`
	Expiration *time.Time      `json:"expiration,omitempty"`
}
