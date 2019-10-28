package plugins

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoadDatasourceVersion(t *testing.T) {
	t.Run("If plugin version is not set, it should be treated as plugin version one", func(t *testing.T) {
		pluginJSON, _ := json.Marshal(DataSourcePlugin{})
		datasourcePlugin := DataSourcePlugin{}
		(&datasourcePlugin).Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		assert.True(t, datasourcePlugin.isVersionOne())
	})

	t.Run("If plugin version is set to one, it should be treated as plugin version one", func(t *testing.T) {
		pluginJSON, _ := json.Marshal(DataSourcePlugin{SDK: false})
		datasourcePlugin := DataSourcePlugin{}
		(&datasourcePlugin).Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		assert.True(t, datasourcePlugin.isVersionOne())
		assert.False(t, datasourcePlugin.SDK)
	})

	t.Run("If plugin version is set to two, it should not be treated as plugin version one", func(t *testing.T) {
		pluginJSON, _ := json.Marshal(DataSourcePlugin{SDK: true})
		datasourcePlugin := DataSourcePlugin{}
		(&datasourcePlugin).Load(json.NewDecoder(bytes.NewReader(pluginJSON)), "/tmp")
		assert.False(t, datasourcePlugin.isVersionOne())
		assert.True(t, datasourcePlugin.SDK)
	})
}
