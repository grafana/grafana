package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationStoreUsesProvidedTableName asserts every query resolves the table
// name through the LegacyDatabaseProvider rather than hardcoding "data_source".
func TestIntegrationStoreUsesProvidedTableName(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	ss := SqlStore{
		db:     sqlStore,
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
