package database

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// accessControlStoreTestImpl is a test store implementation which additionally executes a database migrations
type accessControlStoreTestImpl struct {
	AccessControlStore
}

func (ac *accessControlStoreTestImpl) AddMigration(mg *migrator.Migrator) {
	AddAccessControlMigrations(mg)
}

func setupTestEnv(t testing.TB) *accessControlStoreTestImpl {
	t.Helper()

	cfg := setting.NewCfg()
	store := overrideDatabaseInRegistry(cfg)
	sqlStore := sqlstore.InitTestDB(t)
	store.SQLStore = sqlStore

	err := store.Init()
	require.NoError(t, err)
	return &store
}

func overrideDatabaseInRegistry(cfg *setting.Cfg) accessControlStoreTestImpl {
	store := accessControlStoreTestImpl{
		AccessControlStore: AccessControlStore{
			SQLStore: nil,
		},
	}

	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*AccessControlStore); ok {
			return &registry.Descriptor{
				Name:         "Database",
				Instance:     &store,
				InitPriority: descriptor.InitPriority,
			}, true
		}
		return nil, false
	}

	registry.RegisterOverride(overrideServiceFunc)

	return store
}
