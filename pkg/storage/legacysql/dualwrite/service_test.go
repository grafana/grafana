package dualwrite

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

func TestService(t *testing.T) {
	t.Run("dynamic", func(t *testing.T) {
		ctx := context.Background()
		mode, err := ProvideService(featuremgmt.WithFeatures(featuremgmt.FlagProvisioning), kvstore.NewFakeKVStore(), NewFakeConfig(), NewFakeMigrator(), NewFakeMigrationStatusReader(), prometheus.NewRegistry())
		require.NoError(t, err)

		// Use a managed resource so KV-based Status path is exercised.
		gr := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
		status, err := mode.Status(ctx, gr)
		require.NoError(t, err)
		require.Equal(t, StorageStatus{
			Group:        "folder.grafana.app",
			Resource:     "folders",
			WriteLegacy:  true,
			WriteUnified: true,
			ReadUnified:  false,
			Migrated:     0,
			Migrating:    0,
			Runtime:      true,
			UpdateKey:    1,
		}, status, "should start with the right defaults")

		// Start migration
		status, err = mode.StartMigration(ctx, gr, 1)
		require.NoError(t, err)
		require.Equal(t, status.UpdateKey, int64(2), "the key increased")
		require.True(t, status.Migrating > 0, "migration is running")

		status.Migrated = time.Now().UnixMilli()
		status.Migrating = 0
		status, err = mode.Update(ctx, status)
		require.NoError(t, err)
		require.Equal(t, status.UpdateKey, int64(3), "the key increased")
		require.Equal(t, status.Migrating, int64(0), "done migrating")
		require.True(t, status.Migrated > 0, "migration is running")

		status.WriteUnified = false
		status.ReadUnified = true
		_, err = mode.Update(ctx, status)
		require.Error(t, err) // must write unified if we read it

		status.WriteUnified = false
		status.ReadUnified = false
		status.WriteLegacy = false
		_, err = mode.Update(ctx, status)
		require.Error(t, err) // must write something!
	})

	t.Run("storageModeFromConfigMode collapses modes", func(t *testing.T) {
		tests := []struct {
			mode     rest.DualWriterMode
			expected string // "legacy", "dualwrite", or "unified"
		}{
			{rest.Mode0, "legacy"},
			{rest.Mode1, "dualwrite"},
			{rest.Mode2, "dualwrite"},
			{rest.Mode3, "dualwrite"},
			{rest.Mode4, "unified"},
			{rest.Mode5, "unified"},
		}
		for _, tt := range tests {
			got := storageModeFromConfigMode(tt.mode)
			switch tt.expected {
			case "legacy":
				require.Equalf(t, unifiedmigrations.StorageModeLegacy, got, "Mode%d should map to Legacy", tt.mode)
			case "dualwrite":
				require.Equalf(t, unifiedmigrations.StorageModeDualWrite, got, "Mode%d should map to DualWrite", tt.mode)
			case "unified":
				require.Equalf(t, unifiedmigrations.StorageModeUnified, got, "Mode%d should map to Unified", tt.mode)
			}
		}
	})

	t.Run("static NewStorage returns correct type for each collapsed mode", func(t *testing.T) {
		gr := schema.GroupResource{Group: "test.grafana.app", Resource: "widgets"}
		ls := (rest.Storage)(nil)
		us := (rest.Storage)(nil)

		for _, tt := range []struct {
			mode     rest.DualWriterMode
			wantType string // "legacy", "dualwriter", "unified"
		}{
			{rest.Mode0, "legacy"},
			{rest.Mode1, "dualwriter"},
			{rest.Mode2, "dualwriter"},
			{rest.Mode3, "dualwriter"},
			{rest.Mode4, "unified"},
			{rest.Mode5, "unified"},
		} {
			storage, err := NewStaticStorage(gr, tt.mode, ls, us)
			require.NoError(t, err, "Mode%d", tt.mode)
			_, isDual := storage.(*dualWriter)
			switch tt.wantType {
			case "legacy":
				require.Truef(t, storage == ls, "Mode%d should return legacy storage", tt.mode)
			case "dualwriter":
				require.Truef(t, isDual, "Mode%d should return *dualWriter", tt.mode)
			case "unified":
				require.Truef(t, storage == us, "Mode%d should return unified storage", tt.mode)
			}
		}
	})

	t.Run("dynamic NewStorage uses statusReader for non-runtime resources", func(t *testing.T) {
		gr := schema.GroupResource{Group: "test.grafana.app", Resource: "widgets"}
		ls := (rest.Storage)(nil)
		us := (rest.Storage)(nil)

		for _, tt := range []struct {
			name     string
			mode     unifiedmigrations.StorageMode
			wantType string // "legacy", "dualwriter", "unified"
		}{
			{"Legacy", unifiedmigrations.StorageModeLegacy, "legacy"},
			{"DualWrite", unifiedmigrations.StorageModeDualWrite, "dualwriter"},
			{"Unified", unifiedmigrations.StorageModeUnified, "unified"},
		} {
			t.Run(tt.name, func(t *testing.T) {
				statusReader := NewFakeMigrationStatusReader(gr.String(), tt.mode)
				svc, err := ProvideService(
					featuremgmt.WithFeatures(featuremgmt.FlagProvisioning), // enabled=true to get dynamic service
					kvstore.NewFakeKVStore(),
					NewFakeConfig(),
					NewFakeMigrator(),
					statusReader,
					prometheus.NewRegistry(),
				)
				require.NoError(t, err)

				// Non-managed GR: NewStorage delegates directly to statusReader
				storage, err := svc.NewStorage(gr, ls, us)
				require.NoError(t, err)
				_, isDual := storage.(*dualWriter)
				switch tt.wantType {
				case "legacy":
					require.Truef(t, storage == ls, "StorageMode %s should return legacy storage", tt.name)
				case "dualwriter":
					require.Truef(t, isDual, "StorageMode %s should return *dualWriter", tt.name)
				case "unified":
					require.Truef(t, storage == us, "StorageMode %s should return unified storage", tt.name)
				}
			})
		}
	})

	t.Run("dynamic ReadFromUnified uses statusReader for non-managed resources", func(t *testing.T) {
		gr := schema.GroupResource{Group: "iam.grafana.app", Resource: "users"}

		for _, tt := range []struct {
			name string
			mode unifiedmigrations.StorageMode
			want bool
		}{
			{"Legacy", unifiedmigrations.StorageModeLegacy, false},
			{"DualWrite", unifiedmigrations.StorageModeDualWrite, false},
			{"Unified", unifiedmigrations.StorageModeUnified, true},
		} {
			t.Run(tt.name, func(t *testing.T) {
				ctx := context.Background()
				statusReader := NewFakeMigrationStatusReader(gr.String(), tt.mode)
				svc, err := ProvideService(
					featuremgmt.WithFeatures(featuremgmt.FlagProvisioning),
					kvstore.NewFakeKVStore(),
					NewFakeConfig(),
					NewFakeMigrator(),
					statusReader,
					prometheus.NewRegistry(),
				)
				require.NoError(t, err)

				got, err := svc.ReadFromUnified(ctx, gr)
				require.NoError(t, err)
				require.Equalf(t, tt.want, got, "ReadFromUnified for StorageMode %s", tt.name)
			})
		}
	})

	t.Run("dynamic Status uses statusReader for non-managed resources", func(t *testing.T) {
		gr := schema.GroupResource{Group: "iam.grafana.app", Resource: "users"}

		for _, tt := range []struct {
			name   string
			mode   unifiedmigrations.StorageMode
			expect StorageStatus
		}{
			{"Legacy", unifiedmigrations.StorageModeLegacy, StorageStatus{
				Group: gr.Group, Resource: gr.Resource, WriteLegacy: true,
			}},
			{"DualWrite", unifiedmigrations.StorageModeDualWrite, StorageStatus{
				Group: gr.Group, Resource: gr.Resource, WriteLegacy: true, WriteUnified: true,
			}},
			{"Unified", unifiedmigrations.StorageModeUnified, StorageStatus{
				Group: gr.Group, Resource: gr.Resource, WriteUnified: true, ReadUnified: true,
			}},
		} {
			t.Run(tt.name, func(t *testing.T) {
				ctx := context.Background()
				statusReader := NewFakeMigrationStatusReader(gr.String(), tt.mode)
				svc, err := ProvideService(
					featuremgmt.WithFeatures(featuremgmt.FlagProvisioning),
					kvstore.NewFakeKVStore(),
					NewFakeConfig(),
					NewFakeMigrator(),
					statusReader,
					prometheus.NewRegistry(),
				)
				require.NoError(t, err)

				status, err := svc.Status(ctx, gr)
				require.NoError(t, err)
				require.Equal(t, tt.expect, status)
			})
		}
	})

	t.Run("dynamic getStorageMode delegates to statusReader", func(t *testing.T) {
		gr := schema.GroupResource{Group: "iam.grafana.app", Resource: "users"}
		reader := NewFakeMigrationStatusReader(gr.String(), unifiedmigrations.StorageModeUnified)

		svc, err := ProvideService(
			featuremgmt.WithFeatures(featuremgmt.FlagProvisioning),
			kvstore.NewFakeKVStore(),
			NewFakeConfig(),
			NewFakeMigrator(),
			reader,
			prometheus.NewRegistry(),
		)
		require.NoError(t, err)

		got, err := svc.ReadFromUnified(context.Background(), gr)
		require.NoError(t, err)
		require.True(t, got)
	})

	t.Run("static", func(t *testing.T) {
		type testCase struct {
			name  string
			flags featuremgmt.FeatureToggles
			cfg   setting.Cfg

			isStatic              bool
			foldersFromUnified    bool
			dashboardsFromUnified bool
			error                 string
		}

		for _, tc := range []testCase{{
			name:                  "both mode5",
			flags:                 featuremgmt.WithFeatures(featuremgmt.FlagProvisioning),
			dashboardsFromUnified: true,
			foldersFromUnified:    true,
			isStatic:              true,
			cfg: setting.Cfg{
				UnifiedStorage: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: rest.Mode5,
					},
					"folders.folder.grafana.app": {
						DualWriterMode: rest.Mode5,
					},
				},
			}}, {
			name:     "dynamic",
			flags:    featuremgmt.WithFeatures(featuremgmt.FlagProvisioning),
			isStatic: false,
			cfg: setting.Cfg{
				UnifiedStorage: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: rest.Mode3,
					},
				},
			}}, {
			name:  "invalid folder mode4",
			flags: featuremgmt.WithFeatures(featuremgmt.FlagProvisioning),
			error: "must use the same mode",
			cfg: setting.Cfg{
				UnifiedStorage: map[string]setting.UnifiedStorageConfig{
					"folders.folder.grafana.app": {
						DualWriterMode: rest.Mode4,
					},
				},
			}}, {
			name:  "invalid dashboards mode4",
			flags: featuremgmt.WithFeatures(featuremgmt.FlagProvisioning),
			error: "must use the same mode",
			cfg: setting.Cfg{
				UnifiedStorage: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: rest.Mode4,
					},
				},
			}},
		} {
			t.Run(tc.name, func(t *testing.T) {
				ctx := context.Background()
				// Build a fake MigrationStatusReader that matches the config-based modes.
				statusReader := NewFakeMigrationStatusReader(
					"dashboards.dashboard.grafana.app", storageModeFromConfigMode(tc.cfg.UnifiedStorage["dashboards.dashboard.grafana.app"].DualWriterMode),
					"folders.folder.grafana.app", storageModeFromConfigMode(tc.cfg.UnifiedStorage["folders.folder.grafana.app"].DualWriterMode),
				)
				svc, err := ProvideService(tc.flags, kvstore.NewFakeKVStore(), &tc.cfg, NewFakeMigrator(), statusReader, prometheus.NewRegistry())
				if tc.error != "" {
					require.ErrorContains(t, err, tc.error)
					require.Nil(t, svc, "expect a nil service when an error exts")
					return
				}
				require.NoError(t, err)

				_, isStatic := svc.(*staticService)
				require.Equal(t, tc.isStatic, isStatic)

				if isStatic {
					v, err := svc.ReadFromUnified(ctx, schema.GroupResource{
						Group:    "dashboard.grafana.app",
						Resource: "dashboards",
					})
					require.NoError(t, err)
					require.Equal(t, tc.dashboardsFromUnified, v, "XXX")

					v, err = svc.ReadFromUnified(ctx, schema.GroupResource{
						Group:    "folder.grafana.app",
						Resource: "folders",
					})
					require.NoError(t, err)
					require.Equal(t, tc.foldersFromUnified, v, "YYY")
				}
			})
		}
	})
}

func TestNewConfigBasedMigrationStatusReader(t *testing.T) {
	ctx := context.Background()

	cfg := &setting.Cfg{
		UnifiedStorage: map[string]setting.UnifiedStorageConfig{
			"globalroles.iam.grafana.app":      {DualWriterMode: rest.Mode5},
			"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode1},
			"widgets.test.grafana.app":         {DualWriterMode: rest.Mode0},
		},
	}
	reader := NewConfigBasedMigrationStatusReader(cfg)

	// Mode5 → Unified
	mode, err := reader.GetStorageMode(ctx, schema.GroupResource{Group: "iam.grafana.app", Resource: "globalroles"})
	require.NoError(t, err)
	require.Equal(t, unifiedmigrations.StorageModeUnified, mode)

	// Mode1 → DualWrite
	mode, err = reader.GetStorageMode(ctx, schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"})
	require.NoError(t, err)
	require.Equal(t, unifiedmigrations.StorageModeDualWrite, mode)

	// Mode0 → Legacy
	mode, err = reader.GetStorageMode(ctx, schema.GroupResource{Group: "test.grafana.app", Resource: "widgets"})
	require.NoError(t, err)
	require.Equal(t, unifiedmigrations.StorageModeLegacy, mode)

	// Unconfigured resource → Legacy (default)
	mode, err = reader.GetStorageMode(ctx, schema.GroupResource{Group: "unknown.grafana.app", Resource: "things"})
	require.NoError(t, err)
	require.Equal(t, unifiedmigrations.StorageModeLegacy, mode)

	// nil cfg → all Legacy
	nilReader := NewConfigBasedMigrationStatusReader(nil)
	mode, err = nilReader.GetStorageMode(ctx, schema.GroupResource{Group: "iam.grafana.app", Resource: "globalroles"})
	require.NoError(t, err)
	require.Equal(t, unifiedmigrations.StorageModeLegacy, mode)
}

func TestServiceMetrics_NullStatusReader(t *testing.T) {
	gr := schema.GroupResource{Group: "test.grafana.app", Resource: "widgets"}

	cfg := &setting.Cfg{
		UnifiedStorage: map[string]setting.UnifiedStorageConfig{
			gr.String(): {DualWriterMode: rest.Mode1},
		},
	}

	t.Run("staticService increments statusReaderNull when reader is nil", func(t *testing.T) {
		metrics := newTestDualWriterMetrics()
		svc := &staticService{cfg: cfg, metrics: metrics}
		mode := svc.getStorageMode(context.Background(), gr)
		require.Equal(t, unifiedmigrations.StorageModeDualWrite, mode)
		require.Equal(t, float64(1), testutil.ToFloat64(metrics.statusReaderNull.WithLabelValues(gr.String())))
		require.Equal(t, float64(0), testutil.ToFloat64(metrics.statusReaderErrors.WithLabelValues(gr.String())))
	})
}

func TestServiceMetrics_StatusReaderError(t *testing.T) {
	gr := schema.GroupResource{Group: "test.grafana.app", Resource: "widgets"}

	cfg := &setting.Cfg{
		UnifiedStorage: map[string]setting.UnifiedStorageConfig{
			gr.String(): {DualWriterMode: rest.Mode4},
		},
	}

	t.Run("service increments statusReaderErrors and uses reader-returned mode", func(t *testing.T) {
		metrics := newTestDualWriterMetrics()
		svc := &service{
			statusReader: &failingStatusReader{mode: unifiedmigrations.StorageModeDualWrite, err: errors.New("db down")},
			metrics:      metrics,
		}
		mode := svc.getStorageMode(context.Background(), gr)
		require.Equal(t, unifiedmigrations.StorageModeDualWrite, mode, "should use mode returned by reader alongside error")
		require.Equal(t, float64(0), testutil.ToFloat64(metrics.statusReaderNull.WithLabelValues(gr.String())))
		require.Equal(t, float64(1), testutil.ToFloat64(metrics.statusReaderErrors.WithLabelValues(gr.String())))
	})

	t.Run("staticService increments statusReaderErrors and uses reader-returned mode", func(t *testing.T) {
		metrics := newTestDualWriterMetrics()
		svc := &staticService{
			cfg:          cfg,
			statusReader: &failingStatusReader{mode: unifiedmigrations.StorageModeDualWrite, err: errors.New("db down")},
			metrics:      metrics,
		}
		mode := svc.getStorageMode(context.Background(), gr)
		require.Equal(t, unifiedmigrations.StorageModeDualWrite, mode, "should use mode returned by reader alongside error")
		require.Equal(t, float64(0), testutil.ToFloat64(metrics.statusReaderNull.WithLabelValues(gr.String())))
		require.Equal(t, float64(1), testutil.ToFloat64(metrics.statusReaderErrors.WithLabelValues(gr.String())))
	})
}

func TestServiceMetrics_HappyPath(t *testing.T) {
	gr := schema.GroupResource{Group: "test.grafana.app", Resource: "widgets"}
	metrics := newTestDualWriterMetrics()

	svc := &service{
		statusReader: NewFakeMigrationStatusReader(gr.String(), unifiedmigrations.StorageModeUnified),
		metrics:      metrics,
	}
	mode := svc.getStorageMode(context.Background(), gr)
	require.Equal(t, unifiedmigrations.StorageModeUnified, mode)
	require.Equal(t, float64(0), testutil.ToFloat64(metrics.statusReaderNull.WithLabelValues(gr.String())))
	require.Equal(t, float64(0), testutil.ToFloat64(metrics.statusReaderErrors.WithLabelValues(gr.String())))
}

// --- test helpers ---

// newTestDualWriterMetrics creates isolated metrics for test assertions.
func newTestDualWriterMetrics() *dualWriterMetrics {
	return &dualWriterMetrics{
		backgroundErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "test_bg_errors",
		}, []string{"resource", "method"}),
		statusReaderNull: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "test_reader_null",
		}, []string{"resource"}),
		statusReaderErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "test_reader_errors",
		}, []string{"resource"}),
	}
}

// failingStatusReader always returns an error alongside the configured mode.
type failingStatusReader struct {
	mode unifiedmigrations.StorageMode
	err  error
}

func (f *failingStatusReader) GetStorageMode(_ context.Context, _ schema.GroupResource) (unifiedmigrations.StorageMode, error) {
	return f.mode, f.err
}
