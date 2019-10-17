package plugins

import (
	"bytes"
	"encoding/json"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestLoadDatasourceVersion(t *testing.T) {
	t.Run("If plugin version is not set, it should be treated as plugin version one", func(t *testing.T) {
		pluginJSON, _ := json.Marshal(DataSourcePlugin{})
		datasourcePlugin := DataSourcePlugin{}
		(&datasourcePlugin).Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		assert.True(t, datasourcePlugin.isVersionOne())
	})

	t.Run("If plugin version is set to one, it should be treated as plugin version one", func(t *testing.T) {
		pluginJSON, _ := json.Marshal(DataSourcePlugin{Version: 1})
		datasourcePlugin := DataSourcePlugin{}
		(&datasourcePlugin).Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		assert.True(t, datasourcePlugin.isVersionOne())
		assert.Equal(t, datasourcePlugin.Version, 1)
	})

	t.Run("If plugin version is set to two, it should not be treated as plugin version one", func(t *testing.T) {
		pluginJSON, _ := json.Marshal(DataSourcePlugin{Version: 2})
		datasourcePlugin := DataSourcePlugin{}
		(&datasourcePlugin).Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		assert.False(t, datasourcePlugin.isVersionOne())
		assert.Equal(t, datasourcePlugin.Version, 2)
	})
}
