package router

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

const devTestManifest = `{
  "apiVersion": "apps.grafana.app/v1alpha2",
  "kind": "AppManifest",
  "metadata": {"name": "widgets"},
  "spec": {
    "appName": "widgets",
    "group": "widgets.ext.grafana.app",
    "versions": [{
      "name": "v0alpha1",
      "served": true,
      "kinds": [{"kind": "Widget", "plural": "Widgets", "scope": "Namespaced"}]
    }]
  }
}`

func devTestCfg(t *testing.T, raw string) *setting.Cfg {
	t.Helper()
	cfg := setting.NewCfg()
	var err error
	cfg.Raw, err = ini.Load([]byte(raw))
	require.NoError(t, err)
	return cfg
}

func writeDevManifest(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "manifest.json")
	require.NoError(t, os.WriteFile(path, []byte(body), 0o600))
	return path
}

func TestParseDevTargets(t *testing.T) {
	cfg := devTestCfg(t, `
[router.dev.b_http]
manifest = /tmp/b.json
host = http://127.0.0.1:8080

[router.dev.a_grpc]
manifest = /tmp/a.json
host = 127.0.0.1:10000
plugin_id = grafana-a-app

[router.dev.disabled]
manifest = /tmp/c.json
`)
	targets, err := parseDevTargets(cfg)
	require.NoError(t, err)
	require.Equal(t, []devTargetConfig{
		{Name: "b_http", PluginID: "b_http", Manifest: "/tmp/b.json", Host: "http://127.0.0.1:8080"},
		{Name: "a_grpc", PluginID: "grafana-a-app", Manifest: "/tmp/a.json", Host: "127.0.0.1:10000"},
	}, targets, "section order is kept, and a target without a host is skipped")

	_, err = parseDevTargets(devTestCfg(t, "[router.dev.x]\nhost = http://127.0.0.1:8080\n"))
	require.ErrorContains(t, err, "manifest is required")

	_, err = parseDevTargets(devTestCfg(t, "[router.dev.]\nhost = http://127.0.0.1:8080\n"))
	require.ErrorContains(t, err, "target name is required")

	dev, err := newDevTargets(devTestCfg(t, "[router]\n"), PluginDependencies{})
	require.NoError(t, err)
	require.Nil(t, dev, "no dev sections means no dev targets")
}

func TestDevTargetsBackends(t *testing.T) {
	manifest := writeDevManifest(t, devTestManifest)
	broken := writeDevManifest(t, "{not json")
	cfg := devTestCfg(t, `
[router.dev.http]
manifest = `+manifest+`
host = http://127.0.0.1:8080

[router.dev.broken]
manifest = `+broken+`
host = http://127.0.0.1:8081

[router.dev.grpc]
manifest = `+manifest+`
host = 127.0.0.1:10000
`)
	dev, err := newDevTargets(cfg, PluginDependencies{})
	require.NoError(t, err)
	t.Cleanup(dev.conns.closeConnections)

	backends := dev.backends(t.Context())
	require.Len(t, backends, 2, "the broken manifest is skipped without failing the others")

	for _, b := range backends {
		require.Equal(t, "widgets.ext.grafana.app", b.Group().Name)
		require.Equal(t, sourceDev, b.Source())
		require.True(t, strings.HasPrefix(b.Key(), devKeyPrefix+":"), b.Key())
	}
	require.NotEqual(t, backends[0].Key(), backends[1].Key(), "the host is part of the key")

	httpBackend := backends[0].(*PluginBackend)
	require.Nil(t, httpBackend.acquire, "an HTTP operator holds no gRPC connection")
	_, clientV3, err := httpBackend.client(t.Context(), httpBackend.pluginID)
	require.NoError(t, err)
	require.NotNil(t, clientV3)

	grpcBackend := backends[1].(*PluginBackend)
	require.NotNil(t, grpcBackend.acquire, "a gRPC backend holds its connection")
	release, err := grpcBackend.acquire()
	require.NoError(t, err)
	release()
}

func TestPluginLoaderServesDevTargetsWithoutPluginSources(t *testing.T) {
	cfg := devTestCfg(t, "[router.dev.widgets]\nmanifest = "+writeDevManifest(t, devTestManifest)+"\nhost = http://127.0.0.1:8080\n")
	loader, err := ProvideRoutesLoader(cfg, PluginLoaderDependencies{})
	require.NoError(t, err)

	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 1)
	require.Equal(t, "widgets.ext.grafana.app", backends[0].Group().Name)
}

func TestDevTargetsNotifyOnManifestChange(t *testing.T) {
	manifest := writeDevManifest(t, devTestManifest)
	cfg := devTestCfg(t, "[router.dev.widgets]\nmanifest = "+manifest+"\nhost = http://127.0.0.1:8080\n")
	loader, err := ProvideRoutesLoader(cfg, PluginLoaderDependencies{})
	require.NoError(t, err)

	dirty, err := loader.Notify(t.Context())
	require.NoError(t, err)
	before, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, before, 1)

	requireWake := func(msg string) {
		t.Helper()
		select {
		case <-dirty:
		case <-time.After(5 * time.Second):
			t.Fatal(msg)
		}
	}

	// A sibling file in the watched directory is not a manifest change.
	require.NoError(t, os.WriteFile(filepath.Join(filepath.Dir(manifest), "other.json"), []byte("{}"), 0o600))
	select {
	case <-dirty:
		t.Fatal("a change to another file must not wake the router")
	case <-time.After(3 * devManifestSettle):
	}

	changed := strings.Replace(devTestManifest, `"Widgets"`, `"Gadgets"`, 1)
	require.NoError(t, os.WriteFile(manifest, []byte(changed), 0o600))
	requireWake("rewriting the manifest must wake the router")

	after, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, after, 1)
	require.NotEqual(t, before[0].Key(), after[0].Key(), "a changed manifest changes the key, so the group reloads")

	// Editors and generators often replace the file by renaming another over it.
	tmp := manifest + ".tmp"
	require.NoError(t, os.WriteFile(tmp, []byte(devTestManifest), 0o600))
	require.NoError(t, os.Rename(tmp, manifest))
	requireWake("replacing the manifest must wake the router")
}

func TestDevTargetsDeclareRoles(t *testing.T) {
	manifest := writeDevManifest(t, devTestManifest)
	broken := writeDevManifest(t, "{not json")
	cfg := devTestCfg(t, `
[router.dev.broken]
manifest = `+broken+`
host = http://127.0.0.1:8081

[router.dev.widgets]
manifest = `+manifest+`
host = http://127.0.0.1:8080
`)
	dev, err := newDevTargets(cfg, PluginDependencies{})
	require.NoError(t, err)

	service := &recordingManifestRoleService{}
	dev.declareRoles(t.Context(), service)
	require.Equal(t, 1, service.calls, "a broken manifest is skipped, and the others still declare their roles")
	require.NotEmpty(t, service.roles)

	// A failing declaration is logged, never fatal: it must not stop Grafana from starting.
	dev.declareRoles(t.Context(), &recordingManifestRoleService{err: errors.New("role registration failed")})
	dev.declareRoles(t.Context(), nil)
}

func TestDevTargetsNotifyIgnoresChmod(t *testing.T) {
	manifest := writeDevManifest(t, devTestManifest)
	cfg := devTestCfg(t, "[router.dev.widgets]\nmanifest = "+manifest+"\nhost = http://127.0.0.1:8080\n")
	dev, err := newDevTargets(cfg, PluginDependencies{})
	require.NoError(t, err)
	dirty, err := dev.notify(t.Context())
	require.NoError(t, err)

	require.NoError(t, os.Chmod(manifest, 0o400))
	select {
	case <-dirty:
		t.Fatal("a mode change leaves the manifest as it was")
	case <-time.After(3 * devManifestSettle):
	}
}
