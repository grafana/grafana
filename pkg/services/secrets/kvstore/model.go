package kvstore

import (
	"time"

	"github.com/grafana/grafana/pkg/registry"
)

// SecretMigrationService is used to migrate legacy secrets to new unified secrets.
type SecretMigrationService interface {
	registry.BackgroundService
}

// Item stored in k/v store.
type Item struct {
	Id        int64
	OrgId     *int64
	Namespace *string
	Type      *string
	Value     string

	Created time.Time
	Updated time.Time
}

func (i *Item) TableName() string {
	return "secrets"
}

type Key struct {
	OrgId     int64
	Namespace string
	Type      string
}

func (i *Key) TableName() string {
	return "secrets"
}
