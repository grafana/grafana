package database

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// TestIntegrationStoreUsesProvidedTableName asserts every query resolves the table
// name through the LegacyDatabaseProvider rather than hardcoding "data_keys".
func TestIntegrationStoreUsesProvidedTableName(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	ss := ProvideSecretsStore(func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{
			DB:    sqlStore,
			Table: func(n string) string { return "tenant_" + n },
		}, nil
	})

	ctx := context.Background()
	tests := map[string]func() error{
		"GetDataKey": func() error {
			_, err := ss.GetDataKey(ctx, "id")
			return err
		},
		"GetCurrentDataKey": func() error {
			_, err := ss.GetCurrentDataKey(ctx, "label")
			return err
		},
		"GetAllDataKeys": func() error {
			_, err := ss.GetAllDataKeys(ctx)
			return err
		},
		"CreateDataKey": func() error {
			return ss.CreateDataKey(ctx, &secrets.DataKey{Id: "id", Active: true})
		},
		"DisableDataKeys": func() error {
			return ss.DisableDataKeys(ctx)
		},
		"DeleteDataKey": func() error {
			return ss.DeleteDataKey(ctx, "id")
		},
		"ReEncryptDataKeys": func() error {
			return ss.ReEncryptDataKeys(ctx, nil, "")
		},
	}

	for name, run := range tests {
		t.Run(name, func(t *testing.T) {
			err := run()
			require.Error(t, err)
			require.ErrorContains(t, err, "tenant_data_keys")
		})
	}
}

type tenantCtxKey struct{}

// TestIntegrationStoreIsolatesTenants asserts that two tenants whose data keys share an id and a
// label - each stored in its own data keys table - only ever read and modify their own rows.
func TestIntegrationStoreIsolatesTenants(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	tenants := []string{"tenant_a_", "tenant_b_"}
	for _, prefix := range tenants {
		table := prefix + "data_keys"
		require.NoError(t, sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Exec(fmt.Sprintf("CREATE TABLE %s AS SELECT * FROM data_keys WHERE 1 = 0", table))
			return err
		}))
		t.Cleanup(func() {
			_ = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
				_, err := sess.Exec("DROP TABLE " + table)
				return err
			})
		})
	}

	ss := ProvideSecretsStore(func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		prefix, ok := ctx.Value(tenantCtxKey{}).(string)
		if !ok {
			return nil, fmt.Errorf("no tenant in context")
		}
		return &legacysql.LegacyDatabaseHelper{
			DB:    sqlStore,
			Table: func(n string) string { return prefix + n },
		}, nil
	})

	ctxA := context.WithValue(context.Background(), tenantCtxKey{}, tenants[0])
	ctxB := context.WithValue(context.Background(), tenantCtxKey{}, tenants[1])

	const (
		id    = "shared-id"
		label = "shared-label"
	)
	for ctx, data := range map[context.Context]string{ctxA: "a", ctxB: "b"} {
		require.NoError(t, ss.CreateDataKey(ctx, &secrets.DataKey{
			Id:            id,
			Label:         label,
			Active:        true,
			EncryptedData: []byte(data),
		}))
	}

	assertOwnKey := func(t *testing.T, ctx context.Context, want string) {
		t.Helper()

		key, err := ss.GetDataKey(ctx, id)
		require.NoError(t, err)
		require.Equal(t, []byte(want), key.EncryptedData)

		all, err := ss.GetAllDataKeys(ctx)
		require.NoError(t, err)
		require.Len(t, all, 1)
		require.Equal(t, []byte(want), all[0].EncryptedData)
	}

	t.Run("reads only return the tenant's own keys", func(t *testing.T) {
		assertOwnKey(t, ctxA, "a")
		assertOwnKey(t, ctxB, "b")

		for ctx, want := range map[context.Context]string{ctxA: "a", ctxB: "b"} {
			key, err := ss.GetCurrentDataKey(ctx, label)
			require.NoError(t, err)
			require.Equal(t, []byte(want), key.EncryptedData)
		}
	})

	t.Run("disabling keys does not affect the other tenant", func(t *testing.T) {
		require.NoError(t, ss.DisableDataKeys(ctxA))

		_, err := ss.GetCurrentDataKey(ctxA, label)
		require.ErrorIs(t, err, secrets.ErrDataKeyNotFound)

		key, err := ss.GetCurrentDataKey(ctxB, label)
		require.NoError(t, err)
		require.Equal(t, []byte("b"), key.EncryptedData)
	})

	t.Run("deleting a key does not affect the other tenant", func(t *testing.T) {
		require.NoError(t, ss.DeleteDataKey(ctxA, id))

		_, err := ss.GetDataKey(ctxA, id)
		require.ErrorIs(t, err, secrets.ErrDataKeyNotFound)

		assertOwnKey(t, ctxB, "b")
	})
}
