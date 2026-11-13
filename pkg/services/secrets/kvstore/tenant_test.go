package kvstore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type tenantCtxKey struct{}

// TestIntegrationStoreIsolatesTenants asserts that two tenants whose secrets share an
// (orgId, namespace, type) triple - and therefore a row id in their own secrets tables - never
// read or modify each other's value, neither through the decryption cache nor through the value
// cache in front of the store.
func TestIntegrationStoreIsolatesTenants(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	provider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		prefix, ok := ctx.Value(tenantCtxKey{}).(string)
		if !ok {
			return nil, fmt.Errorf("no tenant in context")
		}
		return &legacysql.LegacyDatabaseHelper{
			DB:    sqlStore,
			Table: func(n string) string { return prefix + n },
		}, nil
	}
	secretsService := manager.SetupTestService(t, fakes.NewFakeSecretsStore())

	newStores := map[string]func() SecretsKVStore{
		"sql": func() SecretsKVStore {
			return NewSQLSecretsKVStore(provider, secretsService, log.New("test.logger"))
		},
		"cached": func() SecretsKVStore {
			return WithCache(NewSQLSecretsKVStore(provider, secretsService, log.New("test.logger")), time.Minute, time.Minute)
		},
	}

	const (
		orgID     = int64(1)
		namespace = "namespace"
		typ       = "type"
	)

	for name, newStore := range newStores {
		t.Run(name, func(t *testing.T) {
			// Fresh tables per tenant, so both tenants' rows get the same id.
			ctxs := make([]context.Context, 0, 2)
			for _, label := range []string{"a", "b"} {
				prefix := fmt.Sprintf("tenant_%s_%s_", label, name)
				createSecretsTable(t, sqlStore, prefix+secretsTable)
				ctxs = append(ctxs, context.WithValue(context.Background(), tenantCtxKey{}, prefix))
			}
			ctxA, ctxB := ctxs[0], ctxs[1]
			kv := newStore()

			require.NoError(t, kv.Set(ctxA, orgID, namespace, typ, "a"))
			require.NoError(t, kv.Set(ctxB, orgID, namespace, typ, "b"))

			assertValue := func(t *testing.T, ctx context.Context, ns string, want string) {
				t.Helper()
				// Read twice so the second read is served from whichever cache the first populated.
				for range 2 {
					value, found, err := kv.Get(ctx, orgID, ns, typ)
					require.NoError(t, err)
					require.True(t, found)
					require.Equal(t, want, value)
				}
			}

			t.Run("reads return the tenant's own value", func(t *testing.T) {
				assertValue(t, ctxA, namespace, "a")
				assertValue(t, ctxB, namespace, "b")

				for ctx, want := range map[context.Context]string{ctxA: "a", ctxB: "b"} {
					keys, err := kv.Keys(ctx, orgID, namespace, typ)
					require.NoError(t, err)
					require.Len(t, keys, 1)

					items, err := kv.GetAll(ctx)
					require.NoError(t, err)
					require.Len(t, items, 1)
					require.Equal(t, want, items[0].Value)
				}
			})

			t.Run("updates do not leak to the other tenant", func(t *testing.T) {
				require.NoError(t, kv.Set(ctxA, orgID, namespace, typ, "a2"))
				assertValue(t, ctxA, namespace, "a2")
				assertValue(t, ctxB, namespace, "b")
			})

			t.Run("renames do not affect the other tenant", func(t *testing.T) {
				require.NoError(t, kv.Rename(ctxA, orgID, namespace, typ, "renamed"))
				assertValue(t, ctxA, "renamed", "a2")
				assertValue(t, ctxB, namespace, "b")

				_, found, err := kv.Get(ctxB, orgID, "renamed", typ)
				require.NoError(t, err)
				require.False(t, found)
			})

			t.Run("deletes do not affect the other tenant", func(t *testing.T) {
				require.NoError(t, kv.Del(ctxB, orgID, namespace, typ))

				_, found, err := kv.Get(ctxB, orgID, namespace, typ)
				require.NoError(t, err)
				require.False(t, found)

				assertValue(t, ctxA, "renamed", "a2")
			})
		})
	}
}

func createSecretsTable(t *testing.T, sqlStore db.DB, name string) {
	t.Helper()

	table := migrator.Table{
		Name: name,
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "type", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "value", Type: migrator.DB_Text, Nullable: true},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
	}
	dialect := sqlStore.GetDialect()
	require.NoError(t, sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Exec(dialect.CreateTableSQL(&table))
		return err
	}))
	t.Cleanup(func() {
		_ = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Exec(dialect.DropTable(name))
			return err
		})
	})
}
