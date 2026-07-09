package datasource

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/setting"
)

func TestApplyDefaultStorageConfig(t *testing.T) {
	newRI := func(pluginID string) utils.ResourceInfo {
		return datasourceV0.DataSourceResourceInfo.WithGroupAndShortName(
			pluginID+".datasource.grafana.app", pluginID,
		)
	}

	t.Run("no-op when StorageOpts is nil", func(t *testing.T) {
		b := &DataSourceAPIBuilder{}
		opts := builder.APIGroupOptions{StorageOpts: nil}
		b.applyDefaultStorageConfig(opts, newRI("testdata"))
	})

	t.Run("no-op when no fallback and no specific config", func(t *testing.T) {
		b := &DataSourceAPIBuilder{}
		storageOpts := &options.StorageOptions{
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{},
		}
		opts := builder.APIGroupOptions{StorageOpts: storageOpts}

		b.applyDefaultStorageConfig(opts, newRI("testdata"))

		_, exists := storageOpts.UnifiedStorageConfig["datasources.testdata.datasource.grafana.app"]
		require.False(t, exists)
	})

	t.Run("fallback is applied when no specific config exists", func(t *testing.T) {
		b := &DataSourceAPIBuilder{}
		storageOpts := &options.StorageOptions{
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				setting.DataSourceResources: {DualWriterMode: rest.Mode1},
			},
		}
		opts := builder.APIGroupOptions{StorageOpts: storageOpts}

		b.applyDefaultStorageConfig(opts, newRI("testdata"))

		cfg, exists := storageOpts.UnifiedStorageConfig["datasources.testdata.datasource.grafana.app"]
		require.True(t, exists)
		require.Equal(t, rest.Mode1, cfg.DualWriterMode)
	})

	t.Run("specific config takes precedence over fallback", func(t *testing.T) {
		b := &DataSourceAPIBuilder{}
		storageOpts := &options.StorageOptions{
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				setting.DataSourceResources:                   {DualWriterMode: rest.Mode1},
				"datasources.testdata.datasource.grafana.app": {DualWriterMode: rest.Mode4},
			},
		}
		opts := builder.APIGroupOptions{StorageOpts: storageOpts}

		b.applyDefaultStorageConfig(opts, newRI("testdata"))

		cfg := storageOpts.UnifiedStorageConfig["datasources.testdata.datasource.grafana.app"]
		require.Equal(t, rest.Mode4, cfg.DualWriterMode)
	})

	t.Run("fallback applies independently per plugin", func(t *testing.T) {
		storageOpts := &options.StorageOptions{
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				setting.DataSourceResources: {DualWriterMode: rest.Mode1},
			},
		}
		opts := builder.APIGroupOptions{StorageOpts: storageOpts}

		for _, pluginID := range []string{"testdata", "prometheus", "loki"} {
			b := &DataSourceAPIBuilder{}
			b.applyDefaultStorageConfig(opts, newRI(pluginID))
		}

		for _, pluginID := range []string{"testdata", "prometheus", "loki"} {
			key := "datasources." + pluginID + ".datasource.grafana.app"
			cfg, exists := storageOpts.UnifiedStorageConfig[key]
			require.True(t, exists, "expected config for %s", pluginID)
			require.Equal(t, rest.Mode1, cfg.DualWriterMode)
		}
	})
}
