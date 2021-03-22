package seeder

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// accessControlStoreTestImpl is a test store implementation which additionally executes a database migrations
type accessControlStoreTestImpl struct {
	database.AccessControlStore
}

func (ac *accessControlStoreTestImpl) AddMigration(mg *migrator.Migrator) {
	database.AddAccessControlMigrations(mg)
}

func setupTestEnv(t testing.TB) *accessControlStoreTestImpl {
	t.Helper()

	cfg := setting.NewCfg()
	store := overrideDatabaseInRegistry(t, cfg)
	sqlStore := sqlstore.InitTestDB(t)
	store.SQLStore = sqlStore

	err := store.Init()
	require.NoError(t, err)
	return &store
}

func overrideDatabaseInRegistry(t testing.TB, cfg *setting.Cfg) accessControlStoreTestImpl {
	t.Helper()

	store := accessControlStoreTestImpl{
		AccessControlStore: database.AccessControlStore{
			SQLStore: nil,
		},
	}

	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*database.AccessControlStore); ok {
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

func TestSeeder(t *testing.T) {
	ac := setupTestEnv(t)

	s := &seeder{
		Store: ac,
		log:   log.New("accesscontrol-test"),
	}

	v1 := accesscontrol.RoleDTO{
		OrgID:   1,
		Name:    "grafana:tests:fake",
		Version: 1,
		Permissions: []accesscontrol.Permission{
			{
				Permission: "ice_cream:eat",
				Scope:      "flavor:vanilla",
			},
			{
				Permission: "ice_cream:eat",
				Scope:      "flavor:chocolate",
			},
		},
	}
	v2 := accesscontrol.RoleDTO{
		OrgID:   1,
		Name:    "grafana:tests:fake",
		Version: 2,
		Permissions: []accesscontrol.Permission{
			{
				Permission: "ice_cream:eat",
				Scope:      "flavor:vanilla",
			},
			{
				Permission: "ice_cream:serve",
				Scope:      "flavor:mint",
			},
			{
				Permission: "candy.liquorice:eat",
				Scope:      "",
			},
		},
	}

	t.Run("create role", func(t *testing.T) {
		id, err := s.createOrUpdateRole(
			context.Background(),
			v1,
			nil,
		)
		require.NoError(t, err)
		assert.NotZero(t, id)

		p, err := s.Store.GetRole(context.Background(), 1, id)
		require.NoError(t, err)

		lookup := permissionMap(p.Permissions)
		assert.Contains(t, lookup, permissionTuple{
			Permission: "ice_cream:eat",
			Scope:      "flavor:vanilla",
		})
		assert.Contains(t, lookup, permissionTuple{
			Permission: "ice_cream:eat",
			Scope:      "flavor:chocolate",
		})

		role := p.Role()

		t.Run("update to same version", func(t *testing.T) {
			err := s.seed(context.Background(), 1, []accesscontrol.RoleDTO{v1}, nil)
			require.NoError(t, err)
		})
		t.Run("update to new role version", func(t *testing.T) {
			err := s.seed(context.Background(), 1, []accesscontrol.RoleDTO{v2}, nil)
			require.NoError(t, err)

			p, err := s.Store.GetRole(context.Background(), 1, role.ID)
			require.NoError(t, err)
			assert.Len(t, p.Permissions, len(v2.Permissions))

			lookup := permissionMap(p.Permissions)
			assert.Contains(t, lookup, permissionTuple{
				Permission: "candy.liquorice:eat",
				Scope:      "",
			})
			assert.NotContains(t, lookup, permissionTuple{
				Permission: "ice_cream:eat",
				Scope:      "flavor:chocolate",
			})
		})
	})
}
