package ualert

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// newTestMigration generates an empty migration to use in tests.
func newTestMigration(t *testing.T) *migration {
	t.Helper()

	return &migration{
		mg: &migrator.Migrator{

			Logger: log.New("test"),
		},
		migratedChannelsPerOrg:    make(map[int64]map[*notificationChannel]struct{}),
		portedChannelGroupsPerOrg: make(map[int64]map[string]string),
		seenChannelUIDs:           make(map[string]struct{}),
	}
}
