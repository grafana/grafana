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
	ID            int64                  `json:"id"`
	Name          string                 `json:"name"`
	Role          org.RoleType           `json:"role"`
	Expiration    *time.Time             `json:"expiration,omitempty"`
	LastUsedAt    *time.Time             `json:"lastUsedAt,omitempty"`
	AccessControl accesscontrol.Metadata `json:"accessControl,omitempty"`
}
