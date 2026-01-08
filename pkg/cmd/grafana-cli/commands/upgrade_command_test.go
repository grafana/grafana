package commands

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
)

func TestUpgradeCommand(t *testing.T) {
	t.Run("Plugin is removed even if upgrade fails", func(t *testing.T) {
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
			// Handle plugin info request
			if r.URL.Path == "/repo/"+pluginID {
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
				return
			}

			// For any other request (like installation), return 500 to cause the upgrade to fail
			// after the removal attempt, which is what we want to test
			w.WriteHeader(http.StatusInternalServerError)
			_, err = w.Write([]byte("Server error"))
			require.NoError(t, err)
		}))
		defer mockServer.Close()

		// Use our test implementation that properly implements GcomToken()
		cmdLine := newTestCommandLine([]string{pluginID}, tmpDir, mockServer.URL)

		// Verify plugin directory exists before attempting upgrade
		_, err = os.Stat(pluginDir)
		require.NoError(t, err)

		err = upgradeCommand(cmdLine)
		require.Error(t, err)
		require.Contains(t, err.Error(), "API returned invalid status: 500 Internal Server Error")

		// Verify plugin directory was removed during the removal step
		_, err = os.Stat(pluginDir)
		require.True(t, os.IsNotExist(err))
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

// Simple args implementation
type simpleArgs []string

func (a simpleArgs) First() string {
	if len(a) > 0 {
		return a[0]
	}
	return ""
}
func (a simpleArgs) Get(int) string  { return "" }
func (a simpleArgs) Tail() []string  { return nil }
func (a simpleArgs) Len() int        { return len(a) }
func (a simpleArgs) Present() bool   { return len(a) > 0 }
func (a simpleArgs) Slice() []string { return []string(a) }

// Base struct with default implementations for unused CommandLine methods
type baseCommandLine struct{}

func (b baseCommandLine) ShowHelp() error               { return nil }
func (b baseCommandLine) ShowVersion()                  {}
func (b baseCommandLine) Application() *cli.App         { return nil }
func (b baseCommandLine) Int(_ string) int              { return 0 }
func (b baseCommandLine) String(_ string) string        { return "" }
func (b baseCommandLine) StringSlice(_ string) []string { return nil }
func (b baseCommandLine) FlagNames() []string           { return nil }
func (b baseCommandLine) Generic(_ string) any          { return nil }
func (b baseCommandLine) Bool(_ string) bool            { return false }
func (b baseCommandLine) PluginURL() string             { return "" }
func (b baseCommandLine) GcomToken() string             { return "" }

// Test implementation - only implements what we actually need
type testCommandLine struct {
	baseCommandLine // Embedded struct provides default implementations
	args            simpleArgs
	pluginDir       string
	repoURL         string
}

func newTestCommandLine(args []string, pluginDir, repoURL string) *testCommandLine {
	return &testCommandLine{args: simpleArgs(args), pluginDir: pluginDir, repoURL: repoURL}
}

// Only implement the methods actually used by upgradeCommand
func (t *testCommandLine) Args() cli.Args          { return t.args }
func (t *testCommandLine) PluginDirectory() string { return t.pluginDir }
func (t *testCommandLine) PluginRepoURL() string   { return t.repoURL }
