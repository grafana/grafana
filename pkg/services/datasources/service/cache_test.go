package service

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationCacheServiceIsolatesTenants asserts that two tenants whose datasources share
// an ID and UID never read each other's datasource from the cache.
func TestIntegrationCacheServiceIsolatesTenants(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	store := db.NewTestStore(t)
	tableFor := func(namespace, n string) string { return strings.ReplaceAll(namespace, "-", "_") + "_" + n }
	tenantProvider := func(namespace string) legacysql.LegacyDatabaseProvider {
		return func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			return &legacysql.LegacyDatabaseHelper{
				DB:    store,
				Table: func(n string) string { return tableFor(namespace, n) },
			}, nil
		}
	}

	const uid = "shared-uid"
	ctxFor := map[string]context.Context{}
	idFor := map[string]int64{}
	for _, namespace := range []string{"stacks-1", "stacks-2"} {
		ctx := request.WithNamespace(context.Background(), namespace)
		require.NoError(t, store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.Table(tableFor(namespace, "data_source")).CreateTable(&datasources.DataSource{})
		}))
		ds, err := CreateStore(log.NewNopLogger(), tenantProvider(namespace)).
			AddDataSource(ctx, &datasources.AddDataSourceCommand{OrgID: 1, Name: namespace, Type: "prometheus", UID: uid})
		require.NoError(t, err)
		ctxFor[namespace] = ctx
		idFor[namespace] = ds.ID //nolint:staticcheck // Preserve legacy field compatibility.
	}
	require.Equal(t, idFor["stacks-1"], idFor["stacks-2"])

	cache := ProvideCacheService(
		localcache.ProvideService(),
		func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			return tenantProvider(request.NamespaceValue(ctx))(ctx)
		},
		guardian.ProvideGuardian(),
	)
	user := &identity.StaticRequester{OrgID: 1}

	// Each lookup also populates the other key type, so warm the cache for the first
	// tenant by ID and check the second tenant by both UID and ID.
	ds, err := cache.GetDatasource(ctxFor["stacks-1"], idFor["stacks-1"], user, false)
	require.NoError(t, err)
	require.Equal(t, "stacks-1", ds.Name)

	ds, err = cache.GetDatasourceByUID(ctxFor["stacks-2"], uid, user, false)
	require.NoError(t, err)
	require.Equal(t, "stacks-2", ds.Name)

	ds, err = cache.GetDatasource(ctxFor["stacks-2"], idFor["stacks-2"], user, false)
	require.NoError(t, err)
	require.Equal(t, "stacks-2", ds.Name)

	ds, err = cache.GetDatasourceByUID(ctxFor["stacks-1"], uid, user, false)
	require.NoError(t, err)
	require.Equal(t, "stacks-1", ds.Name)
}
