package migrations

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
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

func TestIsTargetEligibleForMigrations(t *testing.T) {
	tests := []struct {
		name     string
		targets  []string
		expected bool
	}{
		{name: "all target", targets: []string{"all"}, expected: true},
		{name: "core target", targets: []string{"core"}, expected: true},
		{name: "all among multiple targets", targets: []string{"storage-server", "all"}, expected: true},
		{name: "core among multiple targets", targets: []string{"storage-server", "core"}, expected: true},
		{name: "storage-server only", targets: []string{"storage-server"}, expected: false},
		{name: "empty targets", targets: []string{}, expected: false},
		{name: "other target", targets: []string{"search-server-distributor"}, expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, isTargetEligibleForMigrations(tt.targets))
		})
	}
}
