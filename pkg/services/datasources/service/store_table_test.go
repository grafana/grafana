package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationStoreUsesProvidedTableName asserts every query resolves the table
// name through the LegacyDatabaseProvider rather than hardcoding "data_source".
func TestIntegrationStoreUsesProvidedTableName(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	ss := SqlStore{
		logger: log.NewNopLogger(),
		dbProvider: func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			return &legacysql.LegacyDatabaseHelper{
				DB:    sqlStore,
				Table: func(n string) string { return "tenant_" + n },
			}, nil
		},
	}

	ctx := context.Background()
	tests := map[string]func() error{
		"GetDataSource": func() error {
			_, err := ss.GetDataSource(ctx, &datasources.GetDataSourceQuery{OrgID: 1, UID: "uid"})
			return err
		},
		"GetDataSourceInNamespace": func() error {
			_, err := ss.GetDataSourceInNamespace(ctx, "default", "uid", "prometheus")
			return err
		},
		"GetDataSources": func() error {
			_, err := ss.GetDataSources(ctx, &datasources.GetDataSourcesQuery{OrgID: 1})
			return err
		},
		"GetDataSourcesWithLimit": func() error {
			_, err := ss.GetDataSources(ctx, &datasources.GetDataSourcesQuery{OrgID: 1, DataSourceLimit: 10})
			return err
		},
		"GetAllDataSources": func() error {
			_, err := ss.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
			return err
		},
		"GetDataSourcesByType": func() error {
			_, err := ss.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{Type: "prometheus"})
			return err
		},
		"GetDataSourcesByTypeInOrg": func() error {
			_, err := ss.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{Type: "prometheus", OrgID: 1})
			return err
		},
		"GetPrunableProvisionedDataSources": func() error {
			_, err := ss.GetPrunableProvisionedDataSources(ctx)
			return err
		},
		"AddDataSource": func() error {
			_, err := ss.AddDataSource(ctx, &datasources.AddDataSourceCommand{OrgID: 1, Name: "ds", Type: "prometheus"})
			return err
		},
		"UpdateDataSource": func() error {
			_, err := ss.UpdateDataSource(ctx, &datasources.UpdateDataSourceCommand{ID: 1, OrgID: 1, Name: "ds"})
			return err
		},
		"DeleteDataSource": func() error {
			return ss.DeleteDataSource(ctx, &datasources.DeleteDataSourceCommand{ID: 1, OrgID: 1})
		},
		"Count": func() error {
			_, err := ss.Count(ctx, nil)
			return err
		},
	}

	for name, run := range tests {
		t.Run(name, func(t *testing.T) {
			err := run()
			require.Error(t, err)
			require.ErrorContains(t, err, "tenant_data_source")
		})
	}
}

// TestIntegrationStoreUsesProvidedDatabase asserts every query runs on the connection
// and table from the LegacyDatabaseProvider. The store holds no connection of its own, so a
// tenant whose tables live on another server is queried on that server. The unprefixed
// data_source table holds a default datasource that must survive untouched, so a write that
// resolves the wrong table is caught even when it succeeds.
func TestIntegrationStoreUsesProvidedDatabase(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const tenantTable = "tenant_data_source"
	tenant := db.NewTestStore(t)
	ss := CreateStore(log.NewNopLogger(), func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{
			DB:    tenant,
			Table: func(n string) string { return "tenant_" + n },
		}, nil
	})

	ctx := context.Background()
	require.NoError(t, tenant.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(tenantTable).CreateTable(&datasources.DataSource{})
	}))

	count := func(t *testing.T, table string) int64 {
		t.Helper()
		var count int64
		require.NoError(t, tenant.WithDbSession(ctx, func(sess *db.Session) error {
			var err error
			count, err = sess.Table(table).Count(&datasources.DataSource{})
			return err
		}))
		return count
	}
	isDefault := func(t *testing.T, table string, id int64) bool {
		t.Helper()
		var ds datasources.DataSource
		require.NoError(t, tenant.WithDbSession(ctx, func(sess *db.Session) error {
			has, err := sess.Table(table).ID(id).Get(&ds)
			require.True(t, has)
			return err
		}))
		return ds.IsDefault
	}

	// The unprefixed table is not the tenant's; a default datasource there must never change.
	decoy, err := CreateStore(log.NewNopLogger(), legacysql.NewDatabaseProvider(tenant)).
		AddDataSource(ctx, &datasources.AddDataSourceCommand{OrgID: 1, Name: "decoy", Type: "prometheus", IsDefault: true})
	require.NoError(t, err)
	require.Equal(t, int64(1), count(t, "data_source"))

	ds, err := ss.AddDataSource(ctx, &datasources.AddDataSourceCommand{OrgID: 1, Name: "ds", Type: "prometheus", IsDefault: true})
	require.NoError(t, err)
	require.Equal(t, int64(1), count(t, tenantTable))
	require.Equal(t, int64(1), count(t, "data_source"))
	require.True(t, isDefault(t, tenantTable, ds.ID)) //nolint:staticcheck // Preserve legacy field compatibility.

	got, err := ss.GetDataSource(ctx, &datasources.GetDataSourceQuery{OrgID: 1, UID: ds.UID})
	require.NoError(t, err)
	require.Equal(t, ds.ID, got.ID) //nolint:staticcheck // Preserve legacy field compatibility.

	all, err := ss.GetDataSources(ctx, &datasources.GetDataSourcesQuery{OrgID: 1})
	require.NoError(t, err)
	require.Len(t, all, 1)

	quotas, err := ss.Count(ctx, &quota.ScopeParameters{OrgID: 1})
	require.NoError(t, err)
	orgTag, err := quota.NewTag(datasources.QuotaTargetSrv, datasources.QuotaTarget, quota.OrgScope)
	require.NoError(t, err)
	orgCount, ok := quotas.Get(orgTag)
	require.True(t, ok)
	require.Equal(t, int64(1), orgCount)

	// Adding a second default clears the flag on the first, within the tenant table only.
	other, err := ss.AddDataSource(ctx, &datasources.AddDataSourceCommand{OrgID: 1, Name: "other", Type: "prometheus", IsDefault: true})
	require.NoError(t, err)
	require.Equal(t, int64(2), count(t, tenantTable))
	require.False(t, isDefault(t, tenantTable, ds.ID))     //nolint:staticcheck // Preserve legacy field compatibility.
	require.True(t, isDefault(t, tenantTable, other.ID))   //nolint:staticcheck // Preserve legacy field compatibility.
	require.True(t, isDefault(t, "data_source", decoy.ID)) //nolint:staticcheck // Preserve legacy field compatibility.

	// Updating the first back to default clears the flag on the second.
	_, err = ss.UpdateDataSource(ctx, &datasources.UpdateDataSourceCommand{ID: ds.ID, OrgID: 1, Name: "renamed", Type: "prometheus", IsDefault: true}) //nolint:staticcheck // Preserve legacy field compatibility.
	require.NoError(t, err)
	require.True(t, isDefault(t, tenantTable, ds.ID))      //nolint:staticcheck // Preserve legacy field compatibility.
	require.False(t, isDefault(t, tenantTable, other.ID))  //nolint:staticcheck // Preserve legacy field compatibility.
	require.True(t, isDefault(t, "data_source", decoy.ID)) //nolint:staticcheck // Preserve legacy field compatibility.

	require.NoError(t, ss.DeleteDataSource(ctx, &datasources.DeleteDataSourceCommand{UID: ds.UID, OrgID: 1}))
	require.NoError(t, ss.DeleteDataSource(ctx, &datasources.DeleteDataSourceCommand{UID: other.UID, OrgID: 1}))
	require.Zero(t, count(t, tenantTable))
	require.Equal(t, int64(1), count(t, "data_source"))
}
