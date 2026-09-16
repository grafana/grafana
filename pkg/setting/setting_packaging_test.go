package setting

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// The deb and rpm packages ship bundled plugins inside the package under
// $GRAFANA_HOME/data/plugins-bundled, the post-install scripts copy them to
// $DATA_DIR/plugins-bundled, and the systemd units and the grafana wrapper are what tell Grafana to
// read them from there. Those halves live in separate files that are edited independently, and when
// they disagree Grafana discovers no bundled plugins at all, taking every bundled data source with
// it. Anyone changing the destination has to change both sides, so assert on the literal strings.
const (
	bundledPluginsCopy     = `cp -a "$GRAFANA_HOME/data/plugins-bundled" "$DATA_DIR"`
	bundledPluginsMove     = `mv\s+"?\$GRAFANA_HOME/data/plugins-bundled`
	bundledPluginsOverride = "cfg:default.paths.bundled_plugins=${DATA_DIR}/plugins-bundled"
	bundledPluginsDataDir  = "DATA_DIR=/var/lib/grafana"
)

func TestPackagingBundledPluginsPaths(t *testing.T) {
	t.Run("Post-install scripts copy the bundled plugins into the data directory", func(t *testing.T) {
		scripts := []struct {
			path string
			// The rpm script handles fresh installs and upgrades in separate branches.
			copies int
		}{
			{path: "deb/control/postinst", copies: 1},
			{path: "rpm/control/postinst", copies: 2},
		}

		for _, script := range scripts {
			contents := readPackagingFile(t, script.path)

			require.Equal(t, script.copies, strings.Count(contents, bundledPluginsCopy),
				"%s must copy the bundled plugins to $DATA_DIR", script.path)
			require.NotRegexp(t, bundledPluginsMove, contents,
				"%s must copy rather than move the bundled plugins: moving deletes the packaged copy, so the built-in default stops resolving for anyone whose systemd unit lacks the override", script.path)
		}
	})

	t.Run("Grafana is pointed at the post-install destination", func(t *testing.T) {
		for _, path := range []string{
			"deb/systemd/grafana-server.service",
			"rpm/systemd/grafana-server.service",
			"wrappers/grafana",
		} {
			require.Contains(t, readPackagingFile(t, path), bundledPluginsOverride,
				"%s must override paths.bundled_plugins to match where the post-install script puts the plugins", path)
		}
	})

	t.Run("DATA_DIR resolves to the post-install destination", func(t *testing.T) {
		for _, path := range []string{
			"deb/default/grafana-server",
			"rpm/sysconfig/grafana-server",
			"wrappers/grafana",
		} {
			require.Contains(t, readPackagingFile(t, path), bundledPluginsDataDir,
				"%s must set DATA_DIR so the paths.bundled_plugins override resolves to the copied plugins", path)
		}
	})

	t.Run("Bundled plugins have a path default independent of the packaging", func(t *testing.T) {
		cfg := NewCfg()
		require.NoError(t, cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"}))

		require.Contains(t, cfg.PluginsPaths, filepath.Join(cfg.HomePath, "data", "plugins-bundled"),
			"defaults.ini must keep a bundled_plugins default so tarball and container installs work without an override")
	})
}

func readPackagingFile(t *testing.T, name string) string {
	t.Helper()

	contents, err := os.ReadFile(filepath.Join("..", "..", "packaging", name)) //nolint:gosec // Paths are test constants, not user input.
	require.NoError(t, err)
	return string(contents)
}
