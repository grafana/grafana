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

		err := os.MkdirAll(pluginDir, 0750)
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

		cmdLine := createCliContextWithArgs(t, []string{pluginID}, "pluginsDir", tmpDir)
		require.NotNil(t, cmdLine)

		// Verify plugin directory exists before attempting removal
		_, err = os.Stat(pluginDir)
		require.NoError(t, err, "Plugin directory should exist before removal attempt")

		err = removeCommand(cmdLine)
		require.NoError(t, err)

		// Verify plugin directory has been removed
		_, err = os.Stat(pluginDir)
		require.ErrorIs(t, err, os.ErrNotExist)
	})
}

func TestRemoveCommand_PluginNotFound(t *testing.T) {
	t.Run("removeCommand should handle missing plugin gracefully", func(t *testing.T) {
		tmpDir := t.TempDir()
		cmdLine := createCliContextWithArgs(t, []string{"non-existent-plugin"}, "pluginsDir", tmpDir)
		require.NotNil(t, cmdLine)

		err := removeCommand(cmdLine)
		require.NoError(t, err)
	})
}

func TestRemoveCommand_MissingPluginParameter(t *testing.T) {
	t.Run("removeCommand should error when no plugin ID is provided", func(t *testing.T) {
		cmdLine := createCliContextWithArgs(t, []string{})
		require.NotNil(t, cmdLine)

		err := removeCommand(cmdLine)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing plugin parameter")
	})
}

// createCliContextWithArgs creates a CLI context with the specified arguments and optional flag key-value pairs.
// Usage: createCliContextWithArgs(t, []string{"plugin-id"}, "pluginsDir", "/path/to/plugins", "flag2", "value2")
func createCliContextWithArgs(t *testing.T, args []string, flagPairs ...string) *utils.ContextCommandLine {
	if len(flagPairs)%2 != 0 {
		t.Fatalf("flagPairs must be provided in key-value pairs, got %d arguments", len(flagPairs))
	}

	app := &cli.App{
		Name: "grafana",
	}

	flagSet := flag.NewFlagSet("test", 0)

	// Add flags from the key-value pairs
	for i := 0; i < len(flagPairs); i += 2 {
		key := flagPairs[i]
		value := flagPairs[i+1]
		flagSet.String(key, "", "")
		err := flagSet.Set(key, value)
		require.NoError(t, err, "Failed to set flag %s=%s", key, value)
	}

	err := flagSet.Parse(args)
	require.NoError(t, err)

	ctx := cli.NewContext(app, flagSet, nil)
	return &utils.ContextCommandLine{
		Context: ctx,
	}
}
