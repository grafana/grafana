package plugins

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadDatasourceVersion(t *testing.T) {
	t.Run("If plugin version is not set, it should be treated as plugin version one", func(t *testing.T) {
		refPlug := DataSourcePlugin{}
		pluginJSON, err := json.Marshal(refPlug)
		require.NoError(t, err)

		datasourcePlugin := DataSourcePlugin{}
		err = datasourcePlugin.Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		require.NoError(t, err)
		delete(Plugins, refPlug.Id)
		delete(DataSources, refPlug.Id)

		assert.True(t, datasourcePlugin.isVersionOne())
	})

	t.Run("If plugin version is set to one, it should be treated as plugin version one", func(t *testing.T) {
		refPlug := DataSourcePlugin{SDK: false}
		pluginJSON, err := json.Marshal(refPlug)
		require.NoError(t, err)

		datasourcePlugin := DataSourcePlugin{}
		err = datasourcePlugin.Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		require.NoError(t, err)
		delete(Plugins, refPlug.Id)
		delete(DataSources, refPlug.Id)

		assert.True(t, datasourcePlugin.isVersionOne())
		assert.False(t, datasourcePlugin.SDK)
	})

	t.Run("If plugin version is set to two, it should not be treated as plugin version one", func(t *testing.T) {
		refPlug := DataSourcePlugin{SDK: true}
		pluginJSON, err := json.Marshal(refPlug)
		require.NoError(t, err)

		origToggles := setting.FeatureToggles
		setting.FeatureToggles = map[string]bool{"expressions": true}
		datasourcePlugin := DataSourcePlugin{}
		err = datasourcePlugin.Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		setting.FeatureToggles = origToggles
		require.NoError(t, err)
		delete(Plugins, refPlug.Id)
		delete(DataSources, refPlug.Id)

		assert.False(t, datasourcePlugin.isVersionOne())
		assert.True(t, datasourcePlugin.SDK)
	})

	t.Run("Plugin version two requires expressions feature to be toggled", func(t *testing.T) {
		refPlug := DataSourcePlugin{SDK: true}
		pluginJSON, err := json.Marshal(refPlug)
		require.NoError(t, err)

		require.Nil(t, setting.FeatureToggles, "setting.FeatureToggles shouldn't be set")
		datasourcePlugin := DataSourcePlugin{}
		err = datasourcePlugin.Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		require.EqualError(t, err, "A plugin version 2 was found, but expressions feature toggle is not enabled")
	})
}
