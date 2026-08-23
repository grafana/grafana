package utils

import (
	"flag"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
)

// Regression tests for grafana/grafana#119284: the plugin directory must
// follow the configuration precedence the server uses instead of only looking
// at the raw --pluginsDir flag.

// newTestFlagContext builds a ContextCommandLine from a flag map, mirroring
// how commands/commandstest constructs one (kept local to avoid an import
// cycle: commandstest imports this package).
func newTestFlagContext(flags map[string]string) (*ContextCommandLine, error) {
	app := cli.App{Name: "Test"}
	flagSet := flag.NewFlagSet("Test", 0)
	for name, value := range flags {
		flagSet.String(name, "", "")
		if err := flagSet.Set(name, value); err != nil {
			return nil, err
		}
	}
	return &ContextCommandLine{Context: cli.NewContext(&app, flagSet, nil)}, nil
}

// writeGrafDir creates a minimal home directory whose conf/defaults.ini
// declares the given [paths] keys, so config resolution has a baseline to
// override (applyCommandLineDefaultProperties only touches existing keys).
func writeGrafDir(t *testing.T, paths map[string]string) string {
	t.Helper()
	home := t.TempDir()
	confDir := filepath.Join(home, "conf")
	require.NoError(t, os.MkdirAll(confDir, 0o750))

	content := "[paths]\n"
	for k, v := range paths {
		content += k + " = " + v + "\n"
	}
	// initLogging resolves the default "console" log mode, which requires a
	// log.console section to exist in the parsed configuration.
	content += "\n[log]\nmode = console\n\n[log.console]\nlevel = warn\n"
	require.NoError(t, os.WriteFile(filepath.Join(confDir, "defaults.ini"), []byte(content), 0o640))
	return home
}

func TestPluginDirectory_ExplicitFlagBeatsConfig(t *testing.T) {
	flagDir := t.TempDir()
	configDir := t.TempDir()
	home := writeGrafDir(t, map[string]string{"plugins": "data/plugins"})

	c, err := newTestFlagContext(map[string]string{
		"pluginsDir":      flagDir,
		"homepath":        home,
		"configOverrides": "cfg:default.paths.plugins=" + configDir,
	})
	require.NoError(t, err)

	require.Equal(t, flagDir, c.PluginDirectory())
}

func TestPluginDirectory_HonorsConfigOverride(t *testing.T) {
	configDir := t.TempDir()
	home := writeGrafDir(t, map[string]string{"plugins": "data/plugins"})

	c, err := newTestFlagContext(map[string]string{
		"homepath":        home,
		"configOverrides": "cfg:default.paths.plugins=" + configDir,
	})
	require.NoError(t, err)

	require.Equal(t, configDir, c.PluginDirectory())
}

func TestPluginDirectory_HonorsConfigFile(t *testing.T) {
	configDir := t.TempDir()
	home := writeGrafDir(t, map[string]string{"plugins": "data/plugins"})

	customIni := filepath.Join(t.TempDir(), "custom.ini")
	require.NoError(t, os.WriteFile(customIni, []byte("[paths]\nplugins = "+configDir+"\n"), 0o640))

	c, err := newTestFlagContext(map[string]string{
		"homepath": home,
		"config":   customIni,
	})
	require.NoError(t, err)

	require.Equal(t, configDir, c.PluginDirectory())
}

func TestPluginDirectory_HonorsEnvVar(t *testing.T) {
	configDir := t.TempDir()
	home := writeGrafDir(t, map[string]string{"plugins": "data/plugins"})

	c, err := newTestFlagContext(map[string]string{"homepath": home})
	require.NoError(t, err)

	t.Setenv("GF_PATHS_PLUGINS", configDir)
	require.Equal(t, configDir, c.PluginDirectory())
}

func TestPluginDirectory_PluginDirEnvVarBeatsConfig(t *testing.T) {
	flagEnvDir := t.TempDir()
	configDir := t.TempDir()
	home := writeGrafDir(t, map[string]string{"plugins": "data/plugins"})

	c, err := newTestFlagContext(map[string]string{
		"pluginsDir":      flagEnvDir,
		"homepath":        home,
		"configOverrides": "cfg:paths.plugins=" + configDir,
	})
	require.NoError(t, err)

	// GF_PLUGIN_DIR binds to the --pluginsDir flag (urfave marks env-set flags
	// as explicitly set), so it must win over any configuration value.
	t.Setenv("GF_PLUGIN_DIR", flagEnvDir)
	require.Equal(t, flagEnvDir, c.PluginDirectory())
}

func TestPluginDirectory_FallsBackWhenNoConfigSources(t *testing.T) {
	emptyHome := t.TempDir()

	c, err := newTestFlagContext(map[string]string{
		"pluginsDir": "/from/flag/default",
		"homepath":   emptyHome,
	})
	require.NoError(t, err)

	require.Equal(t, "/from/flag/default", c.PluginDirectory())
}

func TestPluginDirectory_MemoizesConfig(t *testing.T) {
	configDir := t.TempDir()
	home := writeGrafDir(t, map[string]string{"plugins": "data/plugins"})

	c, err := newTestFlagContext(map[string]string{
		"homepath":        home,
		"configOverrides": "cfg:default.paths.plugins=" + configDir,
	})
	require.NoError(t, err)

	require.Equal(t, configDir, c.PluginDirectory())

	first, err := c.Config()
	require.NoError(t, err)
	second, err := c.Config()
	require.NoError(t, err)
	require.Same(t, first, second)
}
