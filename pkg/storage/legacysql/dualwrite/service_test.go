package dualwrite

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService(t *testing.T) {
	t.Run("dynamic", func(t *testing.T) {
		ctx := context.Background()
		mode, err := ProvideService(featuremgmt.WithFeatures(featuremgmt.FlagProvisioning), kvstore.NewFakeKVStore(), NewFakeConfig(), NewFakeMigrator(), NewFakeMigrationStatusReader(), ProvideMetrics(prometheus.NewRegistry()))
		require.NoError(t, err)

		gr := schema.GroupResource{Group: "ggg", Resource: "rrr"}
		status, err := mode.Status(ctx, gr)
		require.NoError(t, err)
		require.Equal(t, StorageStatus{
			Group:        "ggg",
			Resource:     "rrr",
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
				svc, err := ProvideService(tc.flags, kvstore.NewFakeKVStore(), &tc.cfg, NewFakeMigrator(), NewFakeMigrationStatusReader(), ProvideMetrics(prometheus.NewRegistry()))
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
