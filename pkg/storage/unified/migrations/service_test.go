package migrations

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestUnifiedStorageMigrationServiceImpl_Run_SkipsMigrations(t *testing.T) {
	tests := []struct {
		name    string
		cfgFunc func(cfg *setting.Cfg)
	}{
		{
			name: "storage type is unified-grpc",
			cfgFunc: func(cfg *setting.Cfg) {
				cfg.Raw.Section("grafana-apiserver").Key("storage_type").SetValue("unified-grpc")
			},
		},
		{
			name: "storage type is unified-kv-grpc",
			cfgFunc: func(cfg *setting.Cfg) {
				cfg.Raw.Section("grafana-apiserver").Key("storage_type").SetValue("unified-kv-grpc")
			},
		},
		{
			name: "target is not all or core",
			cfgFunc: func(cfg *setting.Cfg) {
				cfg.Target = []string{"storage-server"}
			},
		},
		{
			name: "target is empty",
			cfgFunc: func(cfg *setting.Cfg) {
				cfg.Target = []string{}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			tt.cfgFunc(cfg)

			fake := &fakeUnifiedMigrator{}

			gate := resource.NewGCGate()
			svc := &UnifiedStorageMigrationServiceImpl{
				cfg:      cfg,
				migrator: fake,
				gcGate:   gate,
			}

			err := svc.Run(context.Background())
			require.NoError(t, err)
			require.Equal(t, float64(1), testutil.ToFloat64(metrics.MUnifiedStorageMigrationStatus))
			require.Equal(t, 0, fake.migrateCalled)
			require.True(t, gate.Wait(context.Background(), make(chan struct{})),
				"expected Run to release the GC gate on the skip path")
		})
	}
}
func TestProvideUnifiedStorageMigrationService_LockingFallbackToDatabaseSection(t *testing.T) {
	tests := []struct {
		name             string
		configureDB      func(cfg *setting.Cfg)
		configureUnified func(cfg *setting.Cfg)
		wantNoopLocker   bool
	}{
		{
			name: "database migration_locking=false, no unified_storage section -> noop locker",
			configureDB: func(cfg *setting.Cfg) {
				cfg.Raw.Section("database").Key("migration_locking").SetValue("false")
			},
			configureUnified: nil,
			wantNoopLocker:   true,
		},
		{
			name: "database migration_locking=true, no unified_storage section -> mysql locker (FakeDB default)",
			configureDB: func(cfg *setting.Cfg) {
				cfg.Raw.Section("database").Key("migration_locking").SetValue("true")
			},
			configureUnified: nil,
			wantNoopLocker:   false,
		},
		{
			name: "unified_storage migration_locking=false explicit, database true -> noop locker",
			configureDB: func(cfg *setting.Cfg) {
				cfg.Raw.Section("database").Key("migration_locking").SetValue("true")
			},
			configureUnified: func(cfg *setting.Cfg) {
				cfg.Raw.Section("unified_storage").Key("migration_locking").SetValue("false")
			},
			wantNoopLocker: true,
		},
		{
			name: "unified_storage migration_locking=true explicit, database false -> mysql locker",
			configureDB: func(cfg *setting.Cfg) {
				cfg.Raw.Section("database").Key("migration_locking").SetValue("false")
			},
			configureUnified: func(cfg *setting.Cfg) {
				cfg.Raw.Section("unified_storage").Key("migration_locking").SetValue("true")
			},
			wantNoopLocker: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			tt.configureDB(cfg)
			if tt.configureUnified != nil {
				tt.configureUnified(cfg)
			}

			svc := ProvideUnifiedStorageMigrationService(
				&fakeUnifiedMigrator{},
				nil,
				cfg,
				dbtest.NewFakeDB(),
				nil,
				nil,
				nil,
				resource.NewGCGate(),
			)
			impl := svc.(*UnifiedStorageMigrationServiceImpl)
			_, isNoop := impl.tableLocker.(*noopTableLocker)
			require.Equal(t, tt.wantNoopLocker, isNoop, "expected noop locker status mismatch")
		})
	}
}
