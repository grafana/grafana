package cdn

import (
	"context"
	"crypto/tls"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/dskit/backoff"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginerrs"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

var cdnFSComparer = cmp.Comparer(func(fs1 FS, fs2 FS) bool {
	fs1Files, err := fs1.Files()
	if err != nil {
		panic(err)
	}
	fs2Files, err := fs2.Files()
	if err != nil {
		panic(err)
	}

	sort.SliceStable(fs1Files, func(i, j int) bool {
		return fs1Files[i] < fs1Files[j]
	})

	sort.SliceStable(fs2Files, func(i, j int) bool {
		return fs2Files[i] < fs2Files[j]
	})

	return cmp.Equal(fs1Files, fs2Files) && fs1.Base() == fs2.Base()
})

func TestCDNSource_Discover(t *testing.T) {
	t.Run("Discover a CDN enabled plugin", func(t *testing.T) {
		srv := testServer()
		defer srv.Close()

		baseURL, err := url.JoinPath(srv.URL, "grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel")
		require.NoError(t, err)

		expected := []*plugins.FoundBundle{{
			Primary: plugins.FoundPlugin{
				JSONData: plugins.JSONData{
					ID:   "grafana-worldmap-panel",
					Type: "panel",
					Name: "Worldmap Panel",
					Info: plugins.Info{
						Author: plugins.InfoLink{
							Name: "Grafana Labs",
							URL:  "https://grafana.com",
						},
						Version:     "0.3.3",
						Description: "World Map panel for Grafana. Displays time series data or geohash data from Elasticsearch overlaid on a world map.",
						Links: []plugins.InfoLink{
							{Name: "Project site", URL: "https://github.com/grafana/worldmap-panel"},
							{Name: "MIT License", URL: "https://github.com/grafana/worldmap-panel/blob/master/LICENSE"},
						},
						Build: plugins.BuildInfo{
							Time: 1589680271873,
						},
						Logos: plugins.Logos{
							Small: "images/worldmap_logo.svg",
							Large: "images/worldmap_logo.svg",
						},
						Screenshots: []plugins.Screenshots{
							{
								Name: "World",
								Path: "images/worldmap-world.png",
							},
							{
								Name: "USA",
								Path: "images/worldmap-usa.png",
							},
							{
								Name: "Light Theme",
								Path: "images/worldmap-light-theme.png",
							},
						},
						Updated:  "Sun May 17 01:50:53 UTC 2020",
						Keywords: []string{"worldmap", "panel"},
					},
					Dependencies: plugins.Dependencies{
						GrafanaVersion: "3.x.x",
						Plugins:        []plugins.Dependency{},
						Extensions: plugins.ExtensionsDependencies{
							ExposedComponents: []string{},
						},
					},
					Extensions: plugins.Extensions{
						AddedLinks:        []plugins.AddedLink{},
						AddedComponents:   []plugins.AddedComponent{},
						ExposedComponents: []plugins.ExposedComponent{},
						ExtensionPoints:   []plugins.ExtensionPoint{},
						AddedFunctions:    []plugins.AddedFunction{},
					},
				},
				FS: NewFS(baseURL, http.DefaultClient),
			},
		}}

		cfg := &config.PluginManagementCfg{
			PluginsCDNURLTemplate: srv.URL,
			PluginSettings: config.PluginSettings{
				"grafana-worldmap-panel": {
					"cdn":         "true",
					"cdn_version": "0.3.3",
				},
			},
		}

		cdn := pluginscdn.ProvideService(cfg)
		source := NewCDNSource(cfg, cdn, pluginerrs.ProvideErrorTracker())

		got, err := source.Discover(context.Background())
		require.NoError(t, err)

		if !cmp.Equal(got, expected, cmp.Options{cdnFSComparer}) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, cmp.Options{cdnFSComparer}))
		}
	})

	t.Run("Discover a CDN enabled plugin with nested plugin", func(t *testing.T) {
		srv := testServer()
		defer srv.Close()

		baseURL, err := url.JoinPath(srv.URL, "grafana-foobar-app/1.0.0/public/plugins/grafana-foobar-app")
		require.NoError(t, err)

		expectedChildBaseURL, err := url.JoinPath(baseURL, "foobar-panel")
		require.NoError(t, err)

		expected := []*plugins.FoundBundle{{
			Primary: plugins.FoundPlugin{
				JSONData: plugins.JSONData{
					ID:   "grafana-foobar-app",
					Type: "app",
					Name: "Foobar App",
					Info: plugins.Info{
						Author: plugins.InfoLink{
							Name: "Grafana Labs",
							URL:  "https://grafana.com",
						},
						Version:     "1.0.0",
						Description: "Fooing all the bars.",
						Logos: plugins.Logos{
							Small: "images/foobar_logo.svg",
							Large: "images/foobar_logo.svg",
						},
						Keywords: []string{"foobar", "app"},
					},
					Includes: []*plugins.Includes{
						{
							Type:   "panel",
							Path:   "foobar-panel/plugin.json",
							Role:   "Viewer",
							Action: "plugins.app:access",
							Slug:   "",
						},
					},
					Dependencies: plugins.Dependencies{
						GrafanaVersion: "11.x.x",
						Plugins:        []plugins.Dependency{},
						Extensions: plugins.ExtensionsDependencies{
							ExposedComponents: []string{},
						},
					},
					Extensions: plugins.Extensions{
						AddedLinks:        []plugins.AddedLink{},
						AddedComponents:   []plugins.AddedComponent{},
						ExposedComponents: []plugins.ExposedComponent{},
						ExtensionPoints:   []plugins.ExtensionPoint{},
						AddedFunctions:    []plugins.AddedFunction{},
					},
				},
				FS: NewFS(baseURL, http.DefaultClient),
			},
			Children: []*plugins.FoundPlugin{
				{
					JSONData: plugins.JSONData{
						ID:   "grafana-foobar-panel",
						Type: "panel",
						Name: "Foobar Panel",
						Info: plugins.Info{
							Author: plugins.InfoLink{
								Name: "Grafana Labs",
								URL:  "https://grafana.com",
							},
							Version:     "",
							Description: "Fooing all the bars.",
							Logos: plugins.Logos{
								Small: "images/foobar_panel_logo.svg",
								Large: "images/foobar_panel_logo.svg",
							},
							Keywords: []string{"foobar", "panel"},
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion: "11.x.x",
							Plugins:        []plugins.Dependency{},
							Extensions: plugins.ExtensionsDependencies{
								ExposedComponents: []string{},
							},
						},
						Extensions: plugins.Extensions{
							AddedLinks:        []plugins.AddedLink{},
							AddedComponents:   []plugins.AddedComponent{},
							ExposedComponents: []plugins.ExposedComponent{},
							ExtensionPoints:   []plugins.ExtensionPoint{},
							AddedFunctions:    []plugins.AddedFunction{},
						},
					},
					FS: NewFS(expectedChildBaseURL, http.DefaultClient),
				},
			},
		}}

		cfg := &config.PluginManagementCfg{
			PluginsCDNURLTemplate: srv.URL,
			PluginSettings: config.PluginSettings{
				"grafana-foobar-app": {
					"cdn":         "true",
					"cdn_version": "1.0.0",
				},
			},
		}

		cdn := pluginscdn.ProvideService(cfg)
		source := NewCDNSource(cfg, cdn, pluginerrs.ProvideErrorTracker())

		got, err := source.Discover(context.Background())
		require.NoError(t, err)

		if !cmp.Equal(got, expected, cmp.Options{cdnFSComparer}) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, cmp.Options{cdnFSComparer}))
		}
	})

	t.Run("Discover a CDN enabled plugin with nested plugin (declarative mode)", func(t *testing.T) {
		srv := testServer()
		defer srv.Close()

		baseURL, err := url.JoinPath(srv.URL, "grafana-foobar-app/1.0.0/public/plugins/grafana-foobar-app")
		require.NoError(t, err)

		expectedChildBaseURL, err := url.JoinPath(baseURL, "foobar-panel")
		require.NoError(t, err)

		expected := []*plugins.FoundBundle{{
			Primary: plugins.FoundPlugin{
				JSONData: plugins.JSONData{
					ID:   "grafana-foobar-app",
					Type: "app",
					Name: "Foobar App",
					Info: plugins.Info{
						Author: plugins.InfoLink{
							Name: "Grafana Labs",
							URL:  "https://grafana.com",
						},
						Version:     "1.0.0",
						Description: "Fooing all the bars.",
						Logos: plugins.Logos{
							Small: "images/foobar_logo.svg",
							Large: "images/foobar_logo.svg",
						},
						Keywords: []string{"foobar", "app"},
					},
					Includes: []*plugins.Includes{
						{
							Type:   "panel",
							Path:   "foobar-panel/plugin.json",
							Role:   "Viewer",
							Action: "plugins.app:access",
							Slug:   "",
						},
					},
					Dependencies: plugins.Dependencies{
						GrafanaVersion: "11.x.x",
						Plugins:        []plugins.Dependency{},
						Extensions: plugins.ExtensionsDependencies{
							ExposedComponents: []string{},
						},
					},
					Extensions: plugins.Extensions{
						AddedLinks:        []plugins.AddedLink{},
						AddedComponents:   []plugins.AddedComponent{},
						ExposedComponents: []plugins.ExposedComponent{},
						ExtensionPoints:   []plugins.ExtensionPoint{},
						AddedFunctions:    []plugins.AddedFunction{},
					},
				},
				FS: NewFS(baseURL, http.DefaultClient),
			},
			Children: []*plugins.FoundPlugin{
				{
					JSONData: plugins.JSONData{
						ID:   "grafana-foobar-panel",
						Type: "panel",
						Name: "Foobar Panel",
						Info: plugins.Info{
							Author: plugins.InfoLink{
								Name: "Grafana Labs",
								URL:  "https://grafana.com",
							},
							Version:     "",
							Description: "Fooing all the bars.",
							Logos: plugins.Logos{
								Small: "images/foobar_panel_logo.svg",
								Large: "images/foobar_panel_logo.svg",
							},
							Keywords: []string{"foobar", "panel"},
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion: "11.x.x",
							Plugins:        []plugins.Dependency{},
							Extensions: plugins.ExtensionsDependencies{
								ExposedComponents: []string{},
							},
						},
						Extensions: plugins.Extensions{
							AddedLinks:        []plugins.AddedLink{},
							AddedComponents:   []plugins.AddedComponent{},
							ExposedComponents: []plugins.ExposedComponent{},
							ExtensionPoints:   []plugins.ExtensionPoint{},
							AddedFunctions:    []plugins.AddedFunction{},
						},
					},
					FS: NewFS(expectedChildBaseURL, http.DefaultClient),
				},
			},
		}}

		cfg := &config.PluginManagementCfg{
			PluginsCDNURLTemplate: srv.URL,
			PluginSettings: config.PluginSettings{
				"grafana-foobar-app": {
					"cdn_url": baseURL,
				},
				"grafana-foobar-panel": {
					"cdn_url": expectedChildBaseURL,
				},
			},
		}

		cdn := pluginscdn.ProvideService(cfg)
		source := NewCDNSource(cfg, cdn, pluginerrs.ProvideErrorTracker())

		got, err := source.Discover(context.Background())
		require.NoError(t, err)

		if !cmp.Equal(got, expected, cmp.Options{cdnFSComparer}) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, cmp.Options{cdnFSComparer}))
		}
	})

	t.Run("No CDN enabled plugins", func(t *testing.T) {
		cfg := &config.PluginManagementCfg{
			PluginsCDNURLTemplate: "http://example.com",
			PluginSettings:        config.PluginSettings{},
		}

		cdn := pluginscdn.ProvideService(cfg)
		source := NewCDNSource(cfg, cdn, pluginerrs.ProvideErrorTracker())

		got, err := source.Discover(context.Background())
		require.NoError(t, err)
		require.Empty(t, got)
	})

	t.Run("Invalid plugin URLs are skipped", func(t *testing.T) {
		cfg := &config.PluginManagementCfg{
			PluginsCDNURLTemplate: "http://",
			PluginSettings: config.PluginSettings{
				"test-plugin": {
					"cdn":         "true",
					"cdn_version": "1.0.0",
				},
			},
		}

		cdn := pluginscdn.ProvideService(cfg)
		errorTracker := pluginerrs.ProvideErrorTracker()
		source := NewCDNSource(cfg, cdn, errorTracker)
		source.backoffCfg = testBackoffConfig()

		// This should not fail, but return empty results since URLs are invalid
		got, err := source.Discover(context.Background())
		require.NoError(t, err)
		require.Empty(t, got)
		// the plugin is configured, so it is recorded as failed rather than skipped
		require.NotNil(t, errorTracker.Error(context.Background(), "test-plugin"))
	})

	t.Run("Plugins that fail to fetch are recorded and the rest are discovered", func(t *testing.T) {
		srv := testServer()
		defer srv.Close()

		cfg := &config.PluginManagementCfg{
			PluginsCDNURLTemplate: srv.URL,
			PluginSettings: config.PluginSettings{
				"grafana-worldmap-panel": {
					"cdn":         "true",
					"cdn_version": "0.3.3",
				},
				"missing-panel": {
					"cdn":         "true",
					"cdn_version": "1.0.0",
				},
				"dropped-panel": {
					"cdn":         "true",
					"cdn_version": "1.0.0",
				},
			},
		}

		cdn := pluginscdn.ProvideService(cfg)
		errorTracker := pluginerrs.ProvideErrorTracker()
		source := NewCDNSource(cfg, cdn, errorTracker)
		source.backoffCfg = testBackoffConfig()

		got, err := source.Discover(context.Background())
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.Equal(t, "grafana-worldmap-panel", got[0].Primary.JSONData.ID)

		require.Len(t, errorTracker.Errors(context.Background()), 2)
		require.NotNil(t, errorTracker.Error(context.Background(), "missing-panel"))
		require.NotNil(t, errorTracker.Error(context.Background(), "dropped-panel"))
	})
}

func TestCDNSource_Discover_Retries(t *testing.T) {
	const pluginJSON = `{"type": "panel", "name": "Retry Panel", "id": "retry-panel", "info": {"version": "1.0.0"}}`

	drop := func(w http.ResponseWriter) {
		conn, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			panic(err)
		}
		_ = conn.Close()
	}
	serve := func(w http.ResponseWriter) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(pluginJSON))
	}

	tcs := []struct {
		name             string
		handle           func(attempt int32, w http.ResponseWriter)
		tls              bool
		expectedAttempts int32
		expectFound      bool
	}{
		{
			name: "a dropped connection is retried",
			handle: func(attempt int32, w http.ResponseWriter) {
				if attempt == 1 {
					drop(w)
					return
				}
				serve(w)
			},
			expectedAttempts: 2,
			expectFound:      true,
		},
		{
			name: "a server error is retried",
			handle: func(attempt int32, w http.ResponseWriter) {
				if attempt == 1 {
					w.WriteHeader(http.StatusServiceUnavailable)
					return
				}
				serve(w)
			},
			expectedAttempts: 2,
			expectFound:      true,
		},
		{
			name: "not found is not retried",
			handle: func(_ int32, w http.ResponseWriter) {
				w.WriteHeader(http.StatusNotFound)
			},
			expectedAttempts: 1,
		},
		{
			name: "gives up after the last attempt",
			handle: func(_ int32, w http.ResponseWriter) {
				drop(w)
			},
			expectedAttempts: 3,
		},
		{
			name:             "a certificate verification failure is not retried",
			handle:           func(_ int32, w http.ResponseWriter) { serve(w) },
			tls:              true,
			expectedAttempts: 1,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			var attempts atomic.Int32
			mux := http.NewServeMux()
			mux.HandleFunc("/retry-panel/1.0.0/public/plugins/retry-panel/plugin.json", func(w http.ResponseWriter, r *http.Request) {
				tc.handle(attempts.Add(1), w)
			})
			srv := httptest.NewUnstartedServer(mux)
			if tc.tls {
				// The default client doesn't trust the test server's certificate, so the
				// handler is never reached; count handshakes as attempts instead.
				srv.TLS = &tls.Config{GetConfigForClient: func(*tls.ClientHelloInfo) (*tls.Config, error) {
					attempts.Add(1)
					return nil, nil
				}}
				srv.StartTLS()
			} else {
				srv.Start()
			}
			defer srv.Close()

			cfg := &config.PluginManagementCfg{
				PluginsCDNURLTemplate: srv.URL,
				PluginSettings: config.PluginSettings{
					"retry-panel": {
						"cdn":         "true",
						"cdn_version": "1.0.0",
					},
				},
			}

			cdn := pluginscdn.ProvideService(cfg)
			errorTracker := pluginerrs.ProvideErrorTracker()
			source := NewCDNSource(cfg, cdn, errorTracker)
			source.backoffCfg = testBackoffConfig()

			got, err := source.Discover(context.Background())
			require.NoError(t, err)
			require.Equal(t, tc.expectedAttempts, attempts.Load())
			if tc.expectFound {
				require.Len(t, got, 1)
				require.Equal(t, "retry-panel", got[0].Primary.JSONData.ID)
				require.Nil(t, errorTracker.Error(context.Background(), "retry-panel"))
				return
			}
			require.Empty(t, got)
			require.NotNil(t, errorTracker.Error(context.Background(), "retry-panel"))
		})
	}
}

func testBackoffConfig() backoff.Config {
	return backoff.Config{MinBackoff: time.Millisecond, MaxBackoff: time.Millisecond, MaxRetries: 3}
}

func TestCDNSource_PluginClass(t *testing.T) {
	cfg := &config.PluginManagementCfg{}
	cdn := pluginscdn.ProvideService(cfg)
	source := NewCDNSource(cfg, cdn, pluginerrs.ProvideErrorTracker())

	class := source.PluginClass(context.Background())
	require.Equal(t, plugins.ClassExternal, class)
}

func TestCDNSource_DefaultSignature(t *testing.T) {
	testCases := []struct {
		name           string
		pluginSettings config.PluginSettings
		pluginID       string
		expectedSig    plugins.Signature
		expectedOk     bool
	}{
		{
			name:           "Missing signature type defaults to valid",
			pluginSettings: config.PluginSettings{},
			pluginID:       "test-plugin",
			expectedSig:    plugins.Signature{Status: plugins.SignatureStatusValid},
			expectedOk:     true,
		},
		{
			name: "Valid signature type",
			pluginSettings: config.PluginSettings{
				"test-plugin": {
					"signature_type":     "grafana",
					"signature_org_name": "Grafana Labs",
				},
			},
			pluginID: "test-plugin",
			expectedSig: plugins.Signature{
				Status:     plugins.SignatureStatusValid,
				Type:       plugins.SignatureTypeGrafana,
				SigningOrg: "Grafana Labs",
			},
			expectedOk: true,
		},
		{
			name: "Invalid signature type falls back to unsigned",
			pluginSettings: config.PluginSettings{
				"test-plugin": {
					"signature_type": "invalid",
				},
			},
			pluginID: "test-plugin",
			expectedSig: plugins.Signature{
				Status: plugins.SignatureStatusUnsigned,
			},
			expectedOk: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &config.PluginManagementCfg{
				PluginSettings: tc.pluginSettings,
			}
			cdn := pluginscdn.ProvideService(cfg)
			source := NewCDNSource(cfg, cdn, pluginerrs.ProvideErrorTracker())

			sig, ok := source.DefaultSignature(context.Background(), tc.pluginID)
			require.Equal(t, tc.expectedOk, ok)
			require.Equal(t, tc.expectedSig, sig)
		})
	}
}

func testServer() *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/plugin.json", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte((`
		{
		  "type": "panel",
		  "name": "Worldmap Panel",
		  "id": "grafana-worldmap-panel",
		  "info": {
			"description": "World Map panel for Grafana. Displays time series data or geohash data from Elasticsearch overlaid on a world map.",
			"author": {
			  "name": "Grafana Labs",
			  "url": "https://grafana.com"
			},
			"keywords": [
			  "worldmap",
			  "panel"
			],
			"logos": {
			  "small": "images/worldmap_logo.svg",
			  "large": "images/worldmap_logo.svg"
			},
			"links": [
			  {
				"name": "Project site",
				"url": "https://github.com/grafana/worldmap-panel"
			  },
			  {
				"name": "MIT License",
				"url": "https://github.com/grafana/worldmap-panel/blob/master/LICENSE"
			  }
			],
			"screenshots": [
			  {
				"name": "World",
				"path": "images/worldmap-world.png"
			  },
			  {
				"name": "USA",
				"path": "images/worldmap-usa.png"
			  },
			  {
				"name": "Light Theme",
				"path": "images/worldmap-light-theme.png"
			  }
			],
			"version": "0.3.3",
			"updated": "Sun May 17 01:50:53 UTC 2020",
			"build": {
			  "time": 1589680271873,
			  "repo": "git@github.com:grafana/worldmap-panel.git",
			  "branch": "v0.3.x",
			  "hash": "74af3ec645c42fed014b62900c008dfcec1657c2",
			  "number": 175
			}
		  },
		  "dependencies": {
			"grafanaVersion": "3.x.x",
			"plugins": []
		  }
		}
	`)))
	})
	mux.HandleFunc("/grafana-foobar-app/1.0.0/public/plugins/grafana-foobar-app/plugin.json", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte((`
		{
		  "type": "app",
		  "name": "Foobar App",
		  "id": "grafana-foobar-app",
		  "info": {
			"description": "Fooing all the bars.",
			"author": {
			  "name": "Grafana Labs",
			  "url": "https://grafana.com"
			},
			"keywords": [
			  "foobar",
			  "app"
			],
			"logos": {
			  "small": "images/foobar_logo.svg",
			  "large": "images/foobar_logo.svg"
			},
			"version": "1.0.0"
		  },
          "includes": [
		    {
			  "type": "panel",
			  "path": "foobar-panel/plugin.json"
		    }
		  ],
		  "dependencies": {
			"grafanaVersion": "11.x.x",
			"plugins": []
		  }
		}
	`)))
	})

	mux.HandleFunc("/grafana-foobar-app/1.0.0/public/plugins/grafana-foobar-app/foobar-panel/plugin.json", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte((`
		{
		  "type": "panel",
		  "name": "Foobar Panel",
		  "id": "grafana-foobar-panel",
		  "info": {
			"description": "Fooing all the bars.",
			"author": {
			  "name": "Grafana Labs",
			  "url": "https://grafana.com"
			},
			"keywords": [
			  "foobar",
			  "panel"
			],
			"logos": {
			  "small": "images/foobar_panel_logo.svg",
			  "large": "images/foobar_panel_logo.svg"
			}
		  },
		  "dependencies": {
			"grafanaVersion": "11.x.x",
			"plugins": []
		  }
		}
	`)))
	})

	// closes the connection without a response, like the CDN shutting down mid-request
	mux.HandleFunc("/dropped-panel/1.0.0/public/plugins/dropped-panel/plugin.json", func(w http.ResponseWriter, r *http.Request) {
		conn, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			panic(err)
		}
		_ = conn.Close()
	})
	return httptest.NewServer(mux)
}

func TestSource_collectBundles(t *testing.T) {
	tcs := []struct {
		name                   string
		foundPlugins           map[pluginKey]plugins.JSONData
		expectedCount          int
		expectedParentChildren map[string][]string
	}{
		{
			name: "single plugin with no children",
			foundPlugins: map[pluginKey]plugins.JSONData{
				{path: "https://example.com/plugin-a", id: "plugin-a", version: "1.0.0"}: {
					ID:   "plugin-a",
					Type: "panel",
					Name: "Plugin A",
				},
			},
			expectedCount: 1,
			expectedParentChildren: map[string][]string{
				"plugin-a": {},
			},
		},
		{
			name: "parent with one child",
			foundPlugins: map[pluginKey]plugins.JSONData{
				{path: "https://example.com/parent-app", id: "parent-app", version: "1.0.0"}: {
					ID:   "parent-app",
					Type: "app",
					Name: "Parent App",
				},
				{path: "https://example.com/parent-app/child-panel", id: "child-panel", version: "1.0.0"}: {
					ID:   "child-panel",
					Type: "panel",
					Name: "Child Panel",
				},
			},
			expectedCount: 1,
			expectedParentChildren: map[string][]string{
				"parent-app": {"child-panel"},
			},
		},
		{
			name: "parent with multiple children",
			foundPlugins: map[pluginKey]plugins.JSONData{
				{path: "https://example.com/parent-app", id: "parent-app", version: "1.0.0"}: {
					ID:   "parent-app",
					Type: "app",
					Name: "Parent App",
				},
				{path: "https://example.com/parent-app/child1", id: "child1", version: "1.0.0"}: {
					ID:   "child1",
					Type: "panel",
					Name: "Child 1",
				},
				{path: "https://example.com/parent-app/child2", id: "child2", version: "1.0.0"}: {
					ID:   "child2",
					Type: "datasource",
					Name: "Child 2",
				},
			},
			expectedCount: 1,
			expectedParentChildren: map[string][]string{
				"parent-app": {"child1", "child2"},
			},
		},
		{
			name: "multiple separate parents",
			foundPlugins: map[pluginKey]plugins.JSONData{
				{path: "https://example.com/app1", id: "app1", version: "1.0.0"}: {
					ID:   "app1",
					Type: "app",
					Name: "App 1",
				},
				{path: "https://example.com/app2", id: "app2", version: "1.0.0"}: {
					ID:   "app2",
					Type: "app",
					Name: "App 2",
				},
				{path: "https://example.com/app1/panel1", id: "panel1", version: "1.0.0"}: {
					ID:   "panel1",
					Type: "panel",
					Name: "Panel 1",
				},
			},
			expectedCount: 2,
			expectedParentChildren: map[string][]string{
				"app1": {"panel1"},
				"app2": {},
			},
		},
		{
			name:                   "empty input",
			foundPlugins:           map[pluginKey]plugins.JSONData{},
			expectedCount:          0,
			expectedParentChildren: map[string][]string{},
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &config.PluginManagementCfg{}
			cdn := pluginscdn.ProvideService(cfg)
			source := NewCDNSource(cfg, cdn, pluginerrs.ProvideErrorTracker())

			result := source.collectBundles(context.Background(), tc.foundPlugins)
			require.Equal(t, tc.expectedCount, len(result))
			if tc.expectedCount == 0 {
				return
			}

			for expectedParent, expectedChildren := range tc.expectedParentChildren {
				// Find the bundle for this parent
				var parentBundle *plugins.FoundBundle
				for _, bundle := range result {
					if bundle.Primary.JSONData.ID == expectedParent {
						parentBundle = bundle
						break
					}
				}
				require.NotNil(t, parentBundle)

				// Check that all expected children are present
				actualChildIDs := make([]string, len(parentBundle.Children))
				for i, child := range parentBundle.Children {
					actualChildIDs[i] = child.JSONData.ID
				}

				require.ElementsMatch(t, expectedChildren, actualChildIDs)
			}

			// Verify no child plugins appear as primary bundles
			childIDs := make(map[string]bool)
			for key := range tc.foundPlugins {
				for parentKey := range tc.foundPlugins {
					if key.path != parentKey.path && strings.HasPrefix(key.path, parentKey.path) {
						childIDs[key.id] = true
						break
					}
				}
			}

			for _, bundle := range result {
				require.False(t, childIDs[bundle.Primary.JSONData.ID])
			}

			// Verify all bundles have proper FS objects
			for _, bundle := range result {
				require.NotNil(t, bundle.Primary.FS)
				for _, child := range bundle.Children {
					require.NotNil(t, child.FS)
				}
			}
		})
	}
}

func TestSource_collectBundles_Includes(t *testing.T) {
	srv := testServer()
	defer srv.Close()

	tcs := []struct {
		name                   string
		foundPlugins           map[pluginKey]plugins.JSONData
		expectedCount          int
		expectedParentChildren map[string][]string
	}{
		{
			name: "single plugin with no children",
			foundPlugins: map[pluginKey]plugins.JSONData{
				{path: "https://example.com/plugin-a", id: "plugin-a", version: "1.0.0"}: {
					ID:   "plugin-a",
					Type: "panel",
					Name: "Plugin A",
				},
			},
			expectedCount: 1,
			expectedParentChildren: map[string][]string{
				"plugin-a": {},
			},
		},
		{
			name: "plugin with includes but no valid children",
			foundPlugins: map[pluginKey]plugins.JSONData{
				{path: "https://example.com/plugin-b", id: "plugin-b", version: "1.0.0"}: {
					ID:   "plugin-b",
					Type: "app",
					Name: "Plugin B",
					Includes: []*plugins.Includes{
						{Type: "app", Path: "some-app/plugin.json"}, // Invalid type
						{Type: "panel", Path: ""},                   // Empty path
					},
				},
			},
			expectedCount: 1,
			expectedParentChildren: map[string][]string{
				"plugin-b": {},
			},
		},
		{
			name: "plugin with valid panel include",
			foundPlugins: map[pluginKey]plugins.JSONData{
				{path: srv.URL + "/grafana-foobar-app/1.0.0/public/plugins/grafana-foobar-app", id: "grafana-foobar-app", version: "1.0.0"}: {
					ID:   "grafana-foobar-app",
					Type: "app",
					Name: "Foobar App",
					Info: plugins.Info{Version: "1.0.0"},
					Includes: []*plugins.Includes{
						{Type: "panel", Path: "foobar-panel/plugin.json"},
					},
				},
			},
			expectedCount: 1,
			expectedParentChildren: map[string][]string{
				"grafana-foobar-app": {"grafana-foobar-panel"},
			},
		},
		{
			name: "multiple plugins with different include scenarios",
			foundPlugins: map[pluginKey]plugins.JSONData{
				{path: "https://example.com/plugin-no-includes", id: "plugin-no-includes", version: "1.0.0"}: {
					ID:   "plugin-no-includes",
					Type: "panel",
					Name: "Plugin No Includes",
				},
				{path: srv.URL + "/grafana-foobar-app/1.0.0/public/plugins/grafana-foobar-app", id: "grafana-foobar-app", version: "1.0.0"}: {
					ID:   "grafana-foobar-app",
					Type: "app",
					Name: "Foobar App",
					Info: plugins.Info{Version: "1.0.0"},
					Includes: []*plugins.Includes{
						{Type: "panel", Path: "foobar-panel/plugin.json"},
					},
				},
			},
			expectedCount: 2,
			expectedParentChildren: map[string][]string{
				"plugin-no-includes": {},
				"grafana-foobar-app": {"grafana-foobar-panel"},
			},
		},
		{
			name:                   "empty input",
			foundPlugins:           map[pluginKey]plugins.JSONData{},
			expectedCount:          0,
			expectedParentChildren: map[string][]string{},
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &config.PluginManagementCfg{
				PluginsCDNURLTemplate: srv.URL,
			}
			cdn := pluginscdn.ProvideService(cfg)
			source := NewCDNSource(cfg, cdn, pluginerrs.ProvideErrorTracker())

			result := source.collectBundles(context.Background(), tc.foundPlugins)
			require.Equal(t, tc.expectedCount, len(result))
			if tc.expectedCount == 0 {
				return
			}

			for expectedParent, expectedChildren := range tc.expectedParentChildren {
				// Find the bundle for this parent
				var parentBundle *plugins.FoundBundle
				for _, bundle := range result {
					if bundle.Primary.JSONData.ID == expectedParent {
						parentBundle = bundle
						break
					}
				}
				require.NotNil(t, parentBundle)

				// Check that all expected children are present
				actualChildIDs := make([]string, len(parentBundle.Children))
				for i, child := range parentBundle.Children {
					actualChildIDs[i] = child.JSONData.ID
				}

				require.ElementsMatch(t, expectedChildren, actualChildIDs)
			}

			// Verify all bundles have proper FS objects
			for _, bundle := range result {
				require.NotNil(t, bundle.Primary.FS)
				for _, child := range bundle.Children {
					require.NotNil(t, child.FS)
				}
			}
		})
	}
}
