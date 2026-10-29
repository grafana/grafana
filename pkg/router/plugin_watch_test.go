package router

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/setting"
)

const watchedPluginManifest = `{
	"apiVersion": "apps.grafana.app/v1alpha2",
	"spec": {"appName": "widgets", "group": "widgets.ext.grafana.app",
		"versions": [{"name": "v1", "served": true, "kinds": [{"kind": "Widget", "plural": "widgets", "scope": "Namespaced"}]}]}
}`

func writePluginFile(t *testing.T, path, content string) {
	t.Helper()
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o750))
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
}

// installWatchedPlugin writes an app plugin the way an install extracts it:
// the directory, then its files.
func installWatchedPlugin(t *testing.T, root, manifest string) string {
	t.Helper()
	dir := filepath.Join(root, "widgets-app")
	writePluginFile(t, filepath.Join(dir, "plugin.json"), `{"id": "widgets-app", "type": "app", "name": "Widgets"}`)
	writePluginFile(t, filepath.Join(dir, "app-sdk-manifest.json"), manifest)
	return dir
}

func watchedPluginLoader(t *testing.T, root string) PluginLoader {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.PluginsPaths = []string{root}
	return PluginLoader{deps: PluginLoaderDependencies{
		PluginDependencies: PluginDependencies{Cfg: cfg},
		PluginSources: &pluginfakes.FakeSourceRegistry{ListFunc: func(context.Context) []plugins.PluginSource {
			return []plugins.PluginSource{sources.NewLocalSource(plugins.ClassExternal, []string{root})}
		}},
	}}
}

func requirePluginWake(t *testing.T, dirty <-chan struct{}, msg string) {
	t.Helper()
	select {
	case <-dirty:
	case <-time.After(5 * time.Second):
		t.Fatal(msg)
	}
}

func requireNoPluginWake(t *testing.T, dirty <-chan struct{}, msg string) {
	t.Helper()
	select {
	case <-dirty:
		t.Fatal(msg)
	case <-time.After(3 * pluginDirSettle):
	}
}

func TestPluginLoaderNotifiesOnLocalPluginChanges(t *testing.T) {
	root := t.TempDir()
	loader := watchedPluginLoader(t, root)

	dirty, err := loader.Notify(t.Context())
	require.NoError(t, err)

	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Empty(t, backends)

	// Install: a new plugin directory, extracted file by file, wakes the router
	// once, and the reload then serves its group.
	dir := installWatchedPlugin(t, root, watchedPluginManifest)
	requirePluginWake(t, dirty, "installing a plugin must wake the router")
	requireNoPluginWake(t, dirty, "one install must wake the router once")

	installed, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, installed, 1)
	require.Equal(t, "widgets.ext.grafana.app", installed[0].Group().Name)

	// Files a running plugin writes are not changes to what it serves.
	writePluginFile(t, filepath.Join(dir, "data", "state.db"), "x")
	writePluginFile(t, filepath.Join(dir, "plugin.log"), "x")
	requireNoPluginWake(t, dirty, "a plugin's own files must not wake the router")

	// Update: a new manifest changes the backend's key, so only it reloads.
	writePluginFile(t, filepath.Join(dir, "app-sdk-manifest.json"), strings.Replace(watchedPluginManifest, `"Widget"`, `"Gizmo"`, 1))
	requirePluginWake(t, dirty, "updating a plugin's manifest must wake the router")
	updated, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, updated, 1)
	require.NotEqual(t, installed[0].Key(), updated[0].Key())

	// Uninstall.
	require.NoError(t, os.RemoveAll(dir))
	requirePluginWake(t, dirty, "removing a plugin must wake the router")
	removed, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Empty(t, removed)
}

func TestPluginLoaderNotifiesOnPluginDirectoryReplaced(t *testing.T) {
	root := t.TempDir()
	dir := installWatchedPlugin(t, root, watchedPluginManifest)
	loader := watchedPluginLoader(t, root)
	dirty, err := loader.Notify(t.Context())
	require.NoError(t, err)

	// An update stages the new version, then moves it over the old directory.
	staged := installWatchedPlugin(t, t.TempDir(), strings.Replace(watchedPluginManifest, `"Widget"`, `"Gizmo"`, 1))
	require.NoError(t, os.RemoveAll(dir))
	require.NoError(t, os.Rename(staged, dir))
	requirePluginWake(t, dirty, "replacing a plugin's directory must wake the router")

	// The replacement's files are watched too.
	requireNoPluginWake(t, dirty, "one update must wake the router once")
	writePluginFile(t, filepath.Join(dir, "app-sdk-manifest.json"), watchedPluginManifest)
	requirePluginWake(t, dirty, "a manifest change in the replacement must wake the router")
}

func TestPluginLoaderNotifyIgnoresChmod(t *testing.T) {
	root := t.TempDir()
	dir := installWatchedPlugin(t, root, watchedPluginManifest)
	loader := watchedPluginLoader(t, root)
	dirty, err := loader.Notify(t.Context())
	require.NoError(t, err)

	require.NoError(t, os.Chmod(filepath.Join(dir, "plugin.json"), 0o400))
	requireNoPluginWake(t, dirty, "a mode change leaves the plugin as it was")
}

func TestPluginLoaderNotifyWithoutWatchableRoot(t *testing.T) {
	loader := watchedPluginLoader(t, filepath.Join(t.TempDir(), "missing"))
	dirty, err := loader.Notify(t.Context())
	require.NoError(t, err, "a plugin directory that doesn't exist yet must not fail the router")
	requireNoPluginWake(t, dirty, "nothing changed")
}

func TestPluginLoaderNotifyMergesDevTargets(t *testing.T) {
	root := t.TempDir()
	manifest := writeDevManifest(t, devTestManifest)
	cfg := devTestCfg(t, "[router.dev.widgets]\nmanifest = "+manifest+"\nhost = http://127.0.0.1:8080\n")
	cfg.PluginsPaths = []string{root}
	dev, err := newDevTargets(cfg, PluginDependencies{})
	require.NoError(t, err)

	loader := watchedPluginLoader(t, root)
	loader.dev = dev
	dirty, err := loader.Notify(t.Context())
	require.NoError(t, err)

	installWatchedPlugin(t, root, watchedPluginManifest)
	requirePluginWake(t, dirty, "a plugin change must wake the router")
	requireNoPluginWake(t, dirty, "one install must wake the router once")

	require.NoError(t, os.WriteFile(manifest, []byte(strings.Replace(devTestManifest, `"Widgets"`, `"Gadgets"`, 1)), 0o600))
	requirePluginWake(t, dirty, "a dev manifest change must wake the router")
}

func TestPluginLoaderNotifiesOnDistPluginChanges(t *testing.T) {
	root := t.TempDir()
	dist := filepath.Join(root, "widgets-app", "dist")
	writePluginFile(t, filepath.Join(dist, "plugin.json"), `{"id": "widgets-app", "type": "app", "name": "Widgets"}`)
	loader := watchedPluginLoader(t, root)
	dirty, err := loader.Notify(t.Context())
	require.NoError(t, err)

	writePluginFile(t, filepath.Join(dist, "app-sdk-manifest.json"), watchedPluginManifest)
	requirePluginWake(t, dirty, "a manifest added under dist must wake the router")
	requireNoPluginWake(t, dirty, "one change must wake the router once")
}
