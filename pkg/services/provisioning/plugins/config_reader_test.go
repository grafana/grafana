package plugins

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

var (
	incorrectSettings = "./testdata/test-configs/incorrect-settings"
	brokenYaml        = "./testdata/test-configs/broken-yaml"
	emptyFolder       = "./testdata/test-configs/empty_folder"
	unknownApp        = "./testdata/test-configs/unknown-app"
	correctProperties = "./testdata/test-configs/correct-properties"
)

func TestConfigReader(t *testing.T) {
	t.Run("Broken yaml should return error", func(t *testing.T) {
		reader := newConfigReader(log.New("test logger"))
		_, err := reader.readConfig(brokenYaml)
		require.Error(t, err)
	})

	t.Run("Skip invalid directory", func(t *testing.T) {
		cfgProvider := newConfigReader(log.New("test logger"))
		cfg, err := cfgProvider.readConfig(emptyFolder)
		require.NoError(t, err)
		require.Len(t, cfg, 0)
	})

	t.Run("Unknown app plugin should return error", func(t *testing.T) {
		cfgProvider := newConfigReader(log.New("test logger"))
		_, err := cfgProvider.readConfig(unknownApp)
		require.Error(t, err)
		require.Equal(t, "app plugin not installed: nonexisting", err.Error())
	})

	t.Run("Read incorrect properties", func(t *testing.T) {
		cfgProvider := newConfigReader(log.New("test logger"))
		_, err := cfgProvider.readConfig(incorrectSettings)
		require.Error(t, err)
		require.Equal(t, "app item 1 in configuration doesn't contain required field type", err.Error())
	})

	t.Run("Can read correct properties", func(t *testing.T) {
		plugins.Apps = map[string]*plugins.AppPlugin{
			"test-plugin":   {},
			"test-plugin-2": {},
		}

		err := os.Setenv("ENABLE_PLUGIN_VAR", "test-plugin")
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = os.Unsetenv("ENABLE_PLUGIN_VAR")
		})

		cfgProvider := newConfigReader(log.New("test logger"))
		cfg, err := cfgProvider.readConfig(correctProperties)
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
