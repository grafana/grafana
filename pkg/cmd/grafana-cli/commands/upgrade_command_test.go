package commands

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
)

func TestUpgradeCommand_FailsWithImmutableError(t *testing.T) {
	t.Run("upgradeCommand fails with immutable error for plugins using StaticFS", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginID := "test-upgrade-plugin"
		pluginDir := filepath.Join(tmpDir, pluginID)

		err := os.MkdirAll(pluginDir, 0750)
		require.NoError(t, err)

		pluginJSON := `{
			"id": "test-upgrade-plugin",
			"name": "Test Upgrade Plugin",
			"type": "datasource",
			"info": {
				"version": "1.0.0"
			}
		}`
		err = os.WriteFile(filepath.Join(pluginDir, "plugin.json"), []byte(pluginJSON), 0644)
		require.NoError(t, err)

		// Create a mock HTTP server that returns plugin info with a newer version
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			plugin := models.Plugin{
				ID: pluginID,
				Versions: []models.Version{
					{
						Version: "2.0.0", // Newer than the local version (1.0.0)
					},
				},
			}

			w.Header().Set("Content-Type", "application/json")
			err = json.NewEncoder(w).Encode(plugin)
			require.NoError(t, err)
		}))
		defer mockServer.Close()

		cmdLine := createCliContextWithArgs(t, []string{pluginID}, "pluginsDir", tmpDir, "repo", mockServer.URL)
		require.NotNil(t, cmdLine)

		// Verify plugin directory exists before attempting upgrade
		_, err = os.Stat(pluginDir)
		require.NoError(t, err)

		err = upgradeCommand(cmdLine)
		require.Error(t, err)
		require.Contains(t, err.Error(), "plugin test-upgrade-plugin is immutable and therefore cannot be uninstalled")

		// Verify plugin directory still exists since upgrade failed
		_, err = os.Stat(pluginDir)
		require.NoError(t, err)
	})
}

func TestUpgradeCommand_PluginNotFound(t *testing.T) {
	t.Run("upgradeCommand should handle missing plugin gracefully", func(t *testing.T) {
		tmpDir := t.TempDir()
		cmdLine := createCliContextWithArgs(t, []string{"non-existent-plugin"}, "pluginsDir", tmpDir)
		require.NotNil(t, cmdLine)

		err := upgradeCommand(cmdLine)
		require.Error(t, err)
		// Should fail trying to find the local plugin
		require.Contains(t, err.Error(), "could not find plugin non-existent-plugin")
	})
}

func TestUpgradeCommand_MissingPluginParameter(t *testing.T) {
	t.Run("upgradeCommand should error when no plugin ID is provided", func(t *testing.T) {
		cmdLine := createCliContextWithArgs(t, []string{})
		require.NotNil(t, cmdLine)

		err := upgradeCommand(cmdLine)
		require.Error(t, err)
		require.Contains(t, err.Error(), "please specify plugin to update")
	})
}
