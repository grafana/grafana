package commands

import (
	"flag"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

func TestRemoveCommand_StaticFS_FailsWithImmutableError(t *testing.T) {
	t.Run("removeCommand fails with immutable error for plugins using StaticFS", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginID := "test-plugin"
		pluginDir := filepath.Join(tmpDir, pluginID)

		err := os.MkdirAll(pluginDir, 0755)
		require.NoError(t, err)

		pluginJSON := `{
			"id": "test-plugin",
			"name": "Test Plugin",
			"type": "datasource",
			"info": {
				"version": "1.0.0"
			}
		}`
		err = os.WriteFile(filepath.Join(pluginDir, "plugin.json"), []byte(pluginJSON), 0644)
		require.NoError(t, err)

		cmdLine := createCliContextWithArgs(t, tmpDir, []string{pluginID})
		require.NotNil(t, cmdLine)

		// Verify plugin directory exists before attempting removal
		_, err = os.Stat(pluginDir)
		require.NoError(t, err, "Plugin directory should exist before removal attempt")

		err = removeCommand(cmdLine)

		require.Error(t, err, "removeCommand fails when plugin uses StaticFS")
		require.Contains(t, err.Error(), "plugin test-plugin is immutable and therefore cannot be uninstalled")

		// Verify plugin directory still exists since removal failed
		_, err = os.Stat(pluginDir)
		require.NoError(t, err)
	})
}

func TestRemoveCommand_PluginNotFound(t *testing.T) {
	t.Run("removeCommand should handle missing plugin gracefully", func(t *testing.T) {
		tmpDir := t.TempDir()
		cmdLine := createCliContextWithArgs(t, tmpDir, []string{"non-existent-plugin"})
		require.NotNil(t, cmdLine)

		err := removeCommand(cmdLine)
		require.NoError(t, err)
	})
}

func TestRemoveCommand_MissingPluginParameter(t *testing.T) {
	t.Run("removeCommand should error when no plugin ID is provided", func(t *testing.T) {
		cmdLine := createCliContextWithArgs(t, "", []string{})
		require.NotNil(t, cmdLine)

		err := removeCommand(cmdLine)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing plugin parameter")
	})
}

// createCliContextWithArgs creates a CLI context with the specified plugin directory and command arguments
func createCliContextWithArgs(t *testing.T, pluginDir string, args []string) *utils.ContextCommandLine {
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
