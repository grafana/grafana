package plugins

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
)

const (
	incorrectSettings = "./testdata/test-configs/incorrect-settings"
	brokenYaml        = "./testdata/test-configs/broken-yaml"
	emptyFolder       = "./testdata/test-configs/empty_folder"
	unknownApp        = "./testdata/test-configs/unknown-app"
	correctProperties = "./testdata/test-configs/correct-properties"
)

func TestConfigReader(t *testing.T) {
	t.Run("Broken yaml should return error", func(t *testing.T) {
		reader := newConfigReader(log.New("test logger"), nil)
		_, err := reader.readConfig(context.Background(), brokenYaml)
		require.Error(t, err)
	})

	t.Run("Skip invalid directory", func(t *testing.T) {
		cfgProvider := newConfigReader(log.New("test logger"), nil)
		cfg, err := cfgProvider.readConfig(context.Background(), emptyFolder)
		require.NoError(t, err)
		require.Len(t, cfg, 0)
	})

	t.Run("Unknown app plugin should return error", func(t *testing.T) {
		cfgProvider := newConfigReader(log.New("test logger"), plugins.FakePluginStore{})
		_, err := cfgProvider.readConfig(context.Background(), unknownApp)
		require.Error(t, err)
		require.Equal(t, "plugin not installed: \"nonexisting\"", err.Error())
	})

	t.Run("Read incorrect properties", func(t *testing.T) {
		cfgProvider := newConfigReader(log.New("test logger"), nil)
		_, err := cfgProvider.readConfig(context.Background(), incorrectSettings)
		require.Error(t, err)
		require.Equal(t, "app item 1 in configuration doesn't contain required field type", err.Error())
	})

	t.Run("Can read correct properties", func(t *testing.T) {
		pm := plugins.FakePluginStore{
			PluginList: []plugins.PluginDTO{
				{JSONData: plugins.JSONData{ID: "test-plugin"}},
				{JSONData: plugins.JSONData{ID: "test-plugin-2"}},
			},
		}

		t.Setenv("ENABLE_PLUGIN_VAR", "test-plugin")

		cfgProvider := newConfigReader(log.New("test logger"), pm)
		cfg, err := cfgProvider.readConfig(context.Background(), correctProperties)
		require.NoError(t, err)
		require.Len(t, cfg, 1)

		testCases := []struct {
			ExpectedPluginID string
			ExpectedOrgID    int64
			ExpectedOrgName  string
			ExpectedEnabled  bool
		}{
			{ExpectedPluginID: "test-plugin", ExpectedOrgID: 2, ExpectedOrgName: "", ExpectedEnabled: true},
			{ExpectedPluginID: "test-plugin-2", ExpectedOrgID: 3, ExpectedOrgName: "", ExpectedEnabled: false},
			{ExpectedPluginID: "test-plugin", ExpectedOrgID: 0, ExpectedOrgName: "Org 3", ExpectedEnabled: true},
			{ExpectedPluginID: "test-plugin-2", ExpectedOrgID: 1, ExpectedOrgName: "", ExpectedEnabled: true},
		}

		for index, tc := range testCases {
			app := cfg[0].Apps[index]
			require.NotNil(t, app)
			require.Equal(t, tc.ExpectedPluginID, app.PluginID)
			require.Equal(t, tc.ExpectedOrgID, app.OrgID)
			require.Equal(t, tc.ExpectedOrgName, app.OrgName)
			require.Equal(t, tc.ExpectedEnabled, app.Enabled)
		}
	})
}
