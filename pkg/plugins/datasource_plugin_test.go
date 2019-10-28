package plugins

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadDatasourceVersion(t *testing.T) {
	t.Run("If plugin version is not set, it should be treated as plugin version one", func(t *testing.T) {
		pluginJSON, _ := json.Marshal(DataSourcePlugin{})
		datasourcePlugin := DataSourcePlugin{}
		err := (&datasourcePlugin).Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		require.NoError(t, err)
		assert.True(t, datasourcePlugin.isVersionOne())
	})

	t.Run("If plugin version is set to one, it should be treated as plugin version one", func(t *testing.T) {
		pluginJSON, _ := json.Marshal(DataSourcePlugin{SDK: false})
		datasourcePlugin := DataSourcePlugin{}
		err := (&datasourcePlugin).Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		require.NoError(t, err)
		assert.True(t, datasourcePlugin.isVersionOne())
		assert.False(t, datasourcePlugin.SDK)
	})

	t.Run("If plugin version is set to two, it should not be treated as plugin version one", func(t *testing.T) {
		pluginJSON, _ := json.Marshal(DataSourcePlugin{SDK: true})
		datasourcePlugin := DataSourcePlugin{}
		err := (&datasourcePlugin).Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		require.NoError(t, err)
		assert.False(t, datasourcePlugin.isVersionOne())
		assert.True(t, datasourcePlugin.SDK)
	})
}
