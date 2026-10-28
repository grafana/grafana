package meta

import (
	"testing"

	"github.com/stretchr/testify/require"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

func TestPluginAPIs(t *testing.T) {
	t.Run("datasource uses the per-plugin group convention", func(t *testing.T) {
		apis := pluginAPIs("prometheus", pluginsv0alpha1.MetaJSONDataTypeDatasource)
		require.Equal(t, []pluginsv0alpha1.MetaAPI{{
			Group:            "prometheus.datasource.grafana.app",
			PreferredVersion: "v0alpha1",
			Versions:         []string{"v0alpha1"},
		}}, apis)
	})

	t.Run("app uses the plugin ID as its group", func(t *testing.T) {
		apis := pluginAPIs("myorg-test-app", pluginsv0alpha1.MetaJSONDataTypeApp)
		require.Equal(t, []pluginsv0alpha1.MetaAPI{{
			Group:            "myorg-test-app",
			PreferredVersion: "v0alpha1",
			Versions:         []string{"v0alpha1"},
		}}, apis)
	})

	t.Run("other plugin types have no APIs", func(t *testing.T) {
		require.Nil(t, pluginAPIs("timeseries", pluginsv0alpha1.MetaJSONDataTypePanel))
		require.Nil(t, pluginAPIs("my-renderer", pluginsv0alpha1.MetaJSONDataTypeRenderer))
	})
}
