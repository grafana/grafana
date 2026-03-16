package migrations

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
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
			name: "data migrations disabled",
			cfgFunc: func(cfg *setting.Cfg) {
				cfg.DisableDataMigrations = true
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

			migrator := NewMockUnifiedMigrator(t)

			svc := &UnifiedStorageMigrationServiceImpl{
				cfg:      cfg,
				migrator: migrator,
			}

			err := svc.Run(context.Background())
			require.NoError(t, err)
			require.Equal(t, float64(1), testutil.ToFloat64(metrics.MUnifiedStorageMigrationStatus))
			migrator.AssertNotCalled(t, "Migrate")
		})
	}
}
