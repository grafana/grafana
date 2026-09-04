package utils

import (
	"flag"
	"os"
	"path/filepath"
	"runtime"
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
	return newTestFlagContextWithDefaults(nil, flags)
}

// newTestFlagContextWithDefaults registers flags with default values without
// marking them as explicitly set (urfave only records Set() calls in
// FlagNames), reproducing how production flags carry defaults the user never
// passed.
func newTestFlagContextWithDefaults(defaults, set map[string]string) (*ContextCommandLine, error) {
	app := cli.App{Name: "Test"}
	flagSet := flag.NewFlagSet("Test", 0)
	for name, value := range defaults {
		flagSet.String(name, value, "")
	}
	for name, value := range set {
		if flagSet.Lookup(name) == nil {
			flagSet.String(name, "", "")
		}
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
	return writeGrafDirIn(t, home, paths)
}

func writeGrafDirIn(t *testing.T, home string, paths map[string]string) string {
	t.Helper()
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
	home := writeGrafDir(t, map[string]string{"plugins": "data/plugins"})

	c, err := newTestFlagContext(map[string]string{
		"pluginsDir":      flagDir,
		"homepath":        home,
		"configOverrides": "cfg:default.paths.plugins=override/plugins",
	})
	require.NoError(t, err)

	require.Equal(t, flagDir, c.PluginDirectory())
}

func TestPluginDirectory_HonorsConfigOverride(t *testing.T) {
	home := writeGrafDir(t, map[string]string{"plugins": "data/plugins"})
	configDir := filepath.Join(home, "override", "plugins")

	c, err := newTestFlagContext(map[string]string{
		"homepath":        home,
		"configOverrides": "cfg:default.paths.plugins=override/plugins",
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
	home := writeGrafDir(t, map[string]string{"plugins": "data/plugins"})

	t.Setenv("GF_PLUGIN_DIR", flagEnvDir)

	var pluginDir string
	app := cli.App{
		Name: "Test",
		Flags: []cli.Flag{
			&cli.StringFlag{Name: "homepath"},
			&cli.StringFlag{Name: "configOverrides"},
			&cli.StringFlag{
				Name:    "pluginsDir",
				Value:   GetGrafanaPluginDir(runtime.GOOS),
				EnvVars: []string{"GF_PLUGIN_DIR"},
			},
		},
		Action: func(ctx *cli.Context) error {
			pluginDir = (&ContextCommandLine{Context: ctx}).PluginDirectory()
			return nil
		},
	}

	err := app.Run([]string{
		"Test",
		"--homepath", home,
		"--configOverrides", "cfg:default.paths.plugins=override/plugins",
	})
	require.NoError(t, err)
	require.Equal(t, flagEnvDir, pluginDir)
}

func TestPluginDirectory_FallsBackWhenNoConfigSources(t *testing.T) {
	emptyHome := t.TempDir()

	// pluginsDir must NOT be marked as set here: with the flag explicitly set
	// PluginDirectory returns before consulting configuration at all, so this
	// test would never exercise the unresolvable-config fallback. The flag is
	// registered with its production default instead, mirroring cli.go.
	def := GetGrafanaPluginDir(runtime.GOOS)
	c, err := newTestFlagContextWithDefaults(
		map[string]string{"pluginsDir": def},
		map[string]string{"homepath": emptyHome},
	)
	require.NoError(t, err)

	require.Equal(t, def, c.PluginDirectory())
}

func TestPluginDirectory_ExplicitHomepathDoesNotWalkUp(t *testing.T) {
	// An explicit --homepath without conf/defaults.ini must fall back to the
	// flag value even when the parent directory contains a defaults.ini:
	// setHomePath only walks up for an empty homepath, so probing the parent
	// here would let NewCfgFromArgs exit the process.
	parent := t.TempDir()
	writeGrafDirIn(t, parent, map[string]string{"plugins": "data/plugins"})
	emptyHome := filepath.Join(parent, "child")
	require.NoError(t, os.MkdirAll(emptyHome, 0o750))

	c, err := newTestFlagContext(map[string]string{
		"homepath": emptyHome,
	})
	require.NoError(t, err)

	require.False(t, c.configResolvable())
}

func TestPluginDirectory_MemoizesConfig(t *testing.T) {
	home := writeGrafDir(t, map[string]string{"plugins": "data/plugins"})
	configDir := filepath.Join(home, "override", "plugins")

	c, err := newTestFlagContext(map[string]string{
		"homepath":        home,
		"configOverrides": "cfg:default.paths.plugins=override/plugins",
	})
	require.NoError(t, err)

	require.Equal(t, configDir, c.PluginDirectory())

	first, err := c.Config()
	require.NoError(t, err)
	second, err := c.Config()
	require.NoError(t, err)
	require.Same(t, first, second)
}
