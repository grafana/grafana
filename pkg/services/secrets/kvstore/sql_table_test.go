package kvstore

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationSecretsKVStoreUsesProvidedTableName asserts every query resolves the table
// name through the LegacyDatabaseProvider rather than hardcoding "secrets".
func TestIntegrationSecretsKVStoreUsesProvidedTableName(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	store := db.NewTestStore(t)
	secretsService := manager.SetupTestService(t, fakes.NewFakeSecretsStore())
	kv := NewSQLSecretsKVStore(func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{
			DB:    store,
			Table: func(n string) string { return "tenant_" + n },
		}, nil
	}, secretsService, log.NewNopLogger())

	ctx := context.Background()
	tests := map[string]func() error{
		"Get": func() error {
			_, _, err := kv.Get(ctx, 1, "namespace", "type")
			return err
		},
		"Set": func() error {
			return kv.Set(ctx, 1, "namespace", "type", "value")
		},
		"Del": func() error {
			return kv.Del(ctx, 1, "namespace", "type")
		},
		"Keys": func() error {
			_, err := kv.Keys(ctx, 1, "namespace", "type")
			return err
		},
		"Rename": func() error {
			return kv.Rename(ctx, 1, "namespace", "type", "new-namespace")
		},
		"GetAll": func() error {
			_, err := kv.GetAll(ctx)
			return err
		},
	}

	for name, run := range tests {
		t.Run(name, func(t *testing.T) {
			err := run()
			require.Error(t, err)
			require.ErrorContains(t, err, "tenant_secrets")
		})
	}
}

// TestIntegrationSecretsKVStoreIsolatesTenants asserts that two tenants whose secrets share an
// (orgId, namespace, type) triple - and therefore a row id in their own secrets tables - never
// read each other's value, neither from the decryption cache nor from the value cache in front
// of the store.
func TestIntegrationSecretsKVStoreIsolatesTenants(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	store := db.NewTestStore(t)
	tableFor := func(namespace, n string) string { return strings.ReplaceAll(namespace, "-", "_") + "_" + n }

	secretsService := manager.SetupTestService(t, fakes.NewFakeSecretsStore())
	// A single store instance serving both tenants, resolving the table from the request namespace.
	kv := NewSQLSecretsKVStore(func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{
			DB:    store,
			Table: func(n string) string { return tableFor(request.NamespaceValue(ctx), n) },
		}, nil
	}, secretsService, log.NewNopLogger())
	cached := WithCache(kv, time.Minute, time.Minute)

	const (
		orgID = 1
		name  = "shared-name"
	)
	namespaces := []string{"stacks-1", "stacks-2"}
	ctxFor := map[string]context.Context{}
	for _, namespace := range namespaces {
		ctx := request.WithNamespace(context.Background(), namespace)
		require.NoError(t, store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.Table(tableFor(namespace, "secrets")).CreateTable(&Item{})
		}))
		require.NoError(t, kv.Set(ctx, orgID, name, DataSourceSecretType, namespace+"-secret"))
		ctxFor[namespace] = ctx
	}

	// The row ids collide, which is what makes a cache keyed only by id unsafe.
	ids := map[string]int64{}
	for _, namespace := range namespaces {
		items, err := kv.GetAll(ctxFor[namespace])
		require.NoError(t, err)
		require.Len(t, items, 1)
		ids[namespace] = items[0].Id
	}
	require.Equal(t, ids["stacks-1"], ids["stacks-2"])

	for _, namespace := range namespaces {
		value, ok, err := kv.Get(ctxFor[namespace], orgID, name, DataSourceSecretType)
		require.NoError(t, err)
		require.True(t, ok)
		require.Equal(t, namespace+"-secret", value)

		value, ok, err = cached.Get(ctxFor[namespace], orgID, name, DataSourceSecretType)
		require.NoError(t, err)
		require.True(t, ok)
		require.Equal(t, namespace+"-secret", value)
	}

	// Deleting one tenant's secret leaves the other's in place.
	require.NoError(t, cached.Del(ctxFor["stacks-1"], orgID, name, DataSourceSecretType))

	_, ok, err := cached.Get(ctxFor["stacks-1"], orgID, name, DataSourceSecretType)
	require.NoError(t, err)
	require.False(t, ok)

	value, ok, err := cached.Get(ctxFor["stacks-2"], orgID, name, DataSourceSecretType)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "stacks-2-secret", value)
}
