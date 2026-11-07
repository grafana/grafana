package database

import (
	"context"
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
