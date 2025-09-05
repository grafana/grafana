package commands

import (
	"encoding/json"
	"flag"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

func TestUpgradeCommand_StaticFS_FailsWithImmutableError(t *testing.T) {
	t.Run("upgradeCommand fails with immutable error for plugins using StaticFS", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginID := "test-upgrade-plugin"
		pluginDir := filepath.Join(tmpDir, pluginID)

		err := os.MkdirAll(pluginDir, 0755)
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
			json.NewEncoder(w).Encode(plugin)
		}))
		defer mockServer.Close()

		cmdLine := createUpgradeCliContextWithRepo(t, tmpDir, []string{pluginID}, mockServer.URL)
		require.NotNil(t, cmdLine)

		// Verify plugin directory exists before attempting upgrade
		_, err = os.Stat(pluginDir)
		require.NoError(t, err, "Plugin directory should exist before upgrade attempt")

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
		cmdLine := createUpgradeCliContextWithArgs(t, tmpDir, []string{"non-existent-plugin"})
		require.NotNil(t, cmdLine)

		err := upgradeCommand(cmdLine)
		require.Error(t, err)
		// Should fail trying to find the local plugin
		require.Contains(t, err.Error(), "could not find plugin non-existent-plugin")
	})
}

func TestUpgradeCommand_MissingPluginParameter(t *testing.T) {
	t.Run("upgradeCommand should error when no plugin ID is provided", func(t *testing.T) {
		cmdLine := createUpgradeCliContextWithArgs(t, "", []string{})
		require.NotNil(t, cmdLine)

		err := upgradeCommand(cmdLine)
		require.Error(t, err)
		require.Contains(t, err.Error(), "please specify plugin to update")
	})
}

// TestUpgradeCommand_StaticFS_ExplanationAndDemo documents the StaticFS immutability issue
func TestUpgradeCommand_StaticFS_ExplanationAndDemo(t *testing.T) {
	t.Run("demonstrate why upgradeCommand fails with StaticFS", func(t *testing.T) {
		// This test explains the StaticFS immutability issue for upgradeCommand:
		//
		// upgradeCommand workflow:
		// 1. services.GetLocalPlugin() -> finds local plugin using StaticFS (strict mode)
		// 2. services.GetPluginInfoFromRepo() -> gets remote plugin info (requires network)
		// 3. shouldUpgrade() -> compares versions
		// 4. IF upgrade needed -> calls uninstallPlugin() <- THIS IS WHERE STATICFS FAILS
		// 5. installPlugin() -> installs new version
		//
		// The failure occurs at step 4: uninstallPlugin() checks if plugin.FS implements FSRemover
		// StaticFS does NOT implement FSRemover interface -> "immutable" error
		//
		// This is the same root cause as removeCommand failure:
		// Both commands ultimately call uninstallPlugin() which requires FSRemover interface

		t.Log("✅ upgradeCommand and removeCommand both fail with StaticFS for the same reason:")
		t.Log("   - Both call uninstallPlugin() which requires FSRemover interface")
		t.Log("   - StaticFS does NOT implement FSRemover (immutable by design)")
		t.Log("   - Error: 'plugin X is immutable and therefore cannot be uninstalled'")
		t.Log("   - This is demonstrated by TestRemoveCommand_StaticFS_FailsWithImmutableError")
	})
}

// createUpgradeCliContextWithArgs creates a CLI context with the specified plugin directory and command arguments
func createUpgradeCliContextWithArgs(t *testing.T, pluginDir string, args []string) *utils.ContextCommandLine {
	app := &cli.App{
		Name: "grafana",
	}

	flagSet := flag.NewFlagSet("test", 0)
	if pluginDir != "" {
		flagSet.String("pluginsDir", "", "")
		flagSet.Set("pluginsDir", pluginDir)
	}

	err := flagSet.Parse(args)
	require.NoError(t, err)

	ctx := cli.NewContext(app, flagSet, nil)
	return &utils.ContextCommandLine{
		Context: ctx,
	}
}

// createUpgradeCliContextWithRepo creates a CLI context with a specific repo URL
func createUpgradeCliContextWithRepo(t *testing.T, pluginDir string, args []string, repoURL string) *utils.ContextCommandLine {
	app := &cli.App{
		Name: "grafana",
	}

	flagSet := flag.NewFlagSet("test", 0)
	if pluginDir != "" {
		flagSet.String("pluginsDir", "", "")
		flagSet.Set("pluginsDir", pluginDir)
	}

	// Set the repo URL to our mock server
	flagSet.String("repo", "", "")
	flagSet.Set("repo", repoURL)

	err := flagSet.Parse(args)
	require.NoError(t, err)

	ctx := cli.NewContext(app, flagSet, nil)
	return &utils.ContextCommandLine{
		Context: ctx,
	}
}

// createUpgradeCliContextWithFakeRepo creates a CLI context with a fake repo URL to avoid network calls
func createUpgradeCliContextWithFakeRepo(t *testing.T, pluginDir string, args []string) *utils.ContextCommandLine {
	return createUpgradeCliContextWithRepo(t, pluginDir, args, "fake://test-repo")
}

// containsAny checks if the string contains any of the provided substrings
func containsAny(s string, substrings []string) bool {
	for _, sub := range substrings {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
