package datasource

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

func TestDataSourceMigrationRequiresSharedCollection(t *testing.T) {
	ctx := context.Background()
	cfg := setting.NewCfg()
	sqlStore := db.NewTestStore(t, db.WithCfg(cfg), db.WithoutMigrator())
	def := DataSourceMigration(migrator.NewDataSourceMigrator(nil, nil))
	gr := def.Resources[0].GroupResource
	registry := migrations.NewMigrationRegistry()
	registry.Register(def)
	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		gr.String(): {DualWriterMode: rest.Mode1},
	}
	require.NoError(t, migrations.EnsureMigrationLogTable(ctx, sqlStore, cfg))

	insertLog := func(id string) {
		t.Helper()
		require.NoError(t, sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec(
				"INSERT INTO unifiedstorage_migration_log (migration_id, sql, success, error, timestamp) VALUES (?, ?, ?, ?, ?)",
				id, "test", true, "", time.Now(),
			)
			return err
		}))
	}
	storageMode := func() contract.StorageMode {
		t.Helper()
		reader, err := migrations.ProvideMigrationStatusReader(sqlStore, cfg, registry, prometheus.NewRegistry())
		require.NoError(t, err)
		mode, err := reader.GetStorageMode(ctx, gr)
		require.NoError(t, err)
		return mode
	}

	insertLog("datasources migration")
	require.Equal(t, contract.StorageModeDualWrite, storageMode())

	insertLog(def.MigrationID)
	require.Equal(t, contract.StorageModeUnified, storageMode())
}
