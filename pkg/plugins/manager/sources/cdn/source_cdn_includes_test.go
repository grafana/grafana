package cdn

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginerrs"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

func pluginJSONServer(t *testing.T, files map[string]string) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	for path, body := range files {
		mux.HandleFunc(path, func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(body))
		})
	}
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func pluginJSON(id, typ, includes string) string {
	return fmt.Sprintf(`{"id": %q, "type": %q, "name": %q, "info": {"version": "1.0.0"}, "includes": [%s]}`, id, typ, id, includes)
}

func bundleChildren(t *testing.T, srv *httptest.Server, pluginSettings config.PluginSettings) map[string][]string {
	t.Helper()
	cfg := &config.PluginManagementCfg{PluginSettings: pluginSettings}
	source := NewCDNSource(cfg, pluginscdn.ProvideService(cfg), pluginerrs.ProvideErrorTracker())

	got, err := source.Discover(context.Background())
	require.NoError(t, err)

	res := map[string][]string{}
	for _, b := range got {
		ids := make([]string, 0, len(b.Children))
		for _, c := range b.Children {
			ids = append(ids, c.JSONData.ID)
		}
		sort.Strings(ids)
		res[b.Primary.JSONData.ID] = ids
	}
	return res
}

func TestCDNSource_Discover_DeclarativeIncludes(t *testing.T) {
	appIncludes := `{"type": "panel", "name": "panel", "path": "panel/plugin.json"},
		{"type": "datasource", "name": "ds", "path": "ds/plugin.json"},
		{"type": "panel", "name": "gone", "path": "missing/plugin.json"},
		{"type": "page", "name": "ignored", "path": "page/plugin.json"}`
	srv := pluginJSONServer(t, map[string]string{
		"/app/plugin.json":       pluginJSON("test-app", "app", appIncludes),
		"/app/panel/plugin.json": pluginJSON("test-panel", "panel", ""),
		"/app/ds/plugin.json":    pluginJSON("test-datasource", "datasource", ""),
		"/appx/plugin.json":      pluginJSON("test-appx", "app", ""),
	})

	t.Run("only the parent is configured", func(t *testing.T) {
		got := bundleChildren(t, srv, config.PluginSettings{
			"test-app": {"cdn_url": srv.URL + "/app"},
		})
		// The missing include is skipped, as are include types other than panel and datasource
		require.Equal(t, map[string][]string{"test-app": {"test-datasource", "test-panel"}}, got)
	})

	t.Run("a child with its own cdn_url is not added twice", func(t *testing.T) {
		got := bundleChildren(t, srv, config.PluginSettings{
			"test-app":   {"cdn_url": srv.URL + "/app"},
			"test-panel": {"cdn_url": srv.URL + "/app/panel/"},
		})
		require.Equal(t, map[string][]string{"test-app": {"test-datasource", "test-panel"}}, got)
	})

	t.Run("a sibling whose URL shares a prefix is not a child", func(t *testing.T) {
		got := bundleChildren(t, srv, config.PluginSettings{
			"test-app":  {"cdn_url": srv.URL + "/app"},
			"test-appx": {"cdn_url": srv.URL + "/appx"},
		})
		require.Equal(t, map[string][]string{
			"test-app":  {"test-datasource", "test-panel"},
			"test-appx": {},
		}, got)
	})

	t.Run("an explicitly configured child elsewhere wins over the derived URL", func(t *testing.T) {
		srv := pluginJSONServer(t, map[string]string{
			"/app/plugin.json":             pluginJSON("test-app", "app", `{"type": "panel", "name": "panel", "path": "panel/plugin.json"}`),
			"/app/panel/plugin.json":       pluginJSON("test-panel", "panel", ""),
			"/elsewhere/panel/plugin.json": pluginJSON("test-panel", "panel", ""),
		})
		cfg := &config.PluginManagementCfg{PluginSettings: config.PluginSettings{
			"test-app":   {"cdn_url": srv.URL + "/app"},
			"test-panel": {"cdn_url": srv.URL + "/elsewhere/panel"},
		}}
		source := NewCDNSource(cfg, pluginscdn.ProvideService(cfg), pluginerrs.ProvideErrorTracker())

		got, err := source.Discover(context.Background())
		require.NoError(t, err)

		require.Len(t, got, 1, "the configured plugin is nested, not a bundle of its own")
		require.Equal(t, "test-app", got[0].Primary.JSONData.ID)
		require.Len(t, got[0].Children, 1)
		require.Equal(t, srv.URL+"/elsewhere/panel", got[0].Children[0].FS.Base())
	})

	t.Run("a configured child that cannot be fetched is not replaced by the derived URL", func(t *testing.T) {
		srv := pluginJSONServer(t, map[string]string{
			"/app/plugin.json":       pluginJSON("test-app", "app", `{"type": "panel", "name": "panel", "path": "panel/plugin.json"}`),
			"/app/panel/plugin.json": pluginJSON("test-panel", "panel", ""),
		})
		cfg := &config.PluginManagementCfg{PluginSettings: config.PluginSettings{
			"test-app":   {"cdn_url": srv.URL + "/app"},
			"test-panel": {"cdn_url": srv.URL + "/broken/panel"},
		}}
		errorTracker := pluginerrs.ProvideErrorTracker()
		source := NewCDNSource(cfg, pluginscdn.ProvideService(cfg), errorTracker)

		got, err := source.Discover(context.Background())
		require.NoError(t, err)

		require.Len(t, got, 1)
		require.Equal(t, "test-app", got[0].Primary.JSONData.ID)
		require.Empty(t, got[0].Children)
		require.NotNil(t, errorTracker.Error(context.Background(), "test-panel"), "the failure is recorded for the configured plugin")
	})
}
