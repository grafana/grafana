package updatemanager

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
	"github.com/grafana/grafana/pkg/setting"
)

type mockPluginPreinstall struct {
	pluginchecker.Preinstall
}

func (m *mockPluginPreinstall) IsPinned(pluginID string) bool {
	return false
}

func TestPluginUpdateChecker_HasUpdate(t *testing.T) {
	t.Run("update is available", func(t *testing.T) {
		updateCheckURL, _ := url.Parse("https://grafana.com/api/plugins/versioncheck")

		svc := PluginsService{
			availableUpdates: map[string]availableUpdate{
				"test-ds": {
					localVersion:     "0.9.0",
					availableVersion: "1.0.0",
				},
			},
			pluginStore: &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   "test-ds",
							Info: plugins.Info{Version: "0.9.0"},
						},
					},
				},
			},
			updateCheckURL: updateCheckURL,
			updateChecker:  pluginchecker.ProvideService(managedplugins.NewNoop(), provisionedplugins.NewNoop(), &mockPluginPreinstall{}),
			features:       &featuremgmt.FeatureManager{},
		}

		update, exists := svc.HasUpdate(context.Background(), "test-ds")
		require.True(t, exists)
		require.Equal(t, "1.0.0", update)
	})

	t.Run("update is not available", func(t *testing.T) {
		updateCheckURL, _ := url.Parse("https://grafana.com/api/plugins/versioncheck")

		svc := PluginsService{
			availableUpdates: map[string]availableUpdate{
				"test-panel": {
					localVersion:     "0.9.0",
					availableVersion: "0.9.0",
				},
				"test-app": {
					localVersion:     "0.9.0",
					availableVersion: "0.9.0",
				},
			},
			pluginStore: &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   "test-ds",
							Info: plugins.Info{Version: "0.9.0"},
						},
					},
					{
						JSONData: plugins.JSONData{
							ID:   "test-panel",
							Info: plugins.Info{Version: "0.9.0"},
						},
					},
					{
						JSONData: plugins.JSONData{
							ID:   "test-app",
							Info: plugins.Info{Version: "0.9.0"},
						},
					},
				},
			},
			updateCheckURL: updateCheckURL,
			updateChecker:  pluginchecker.ProvideService(managedplugins.NewNoop(), provisionedplugins.NewNoop(), &mockPluginPreinstall{}),
		}

		update, exists := svc.HasUpdate(context.Background(), "test-ds")
		require.False(t, exists)
		require.Empty(t, update)

		update, exists = svc.HasUpdate(context.Background(), "test-panel")
		require.False(t, exists)
		require.Empty(t, update)

		update, exists = svc.HasUpdate(context.Background(), "test-app")
		require.False(t, exists)
		require.Empty(t, update)
	})

	t.Run("update is available but plugin is not in store", func(t *testing.T) {
		updateCheckURL, _ := url.Parse("https://grafana.com/api/plugins/versioncheck")

		svc := PluginsService{
			availableUpdates: map[string]availableUpdate{
				"test-panel": {
					localVersion:     "0.9.0",
					availableVersion: "0.9.0",
				},
			},
			pluginStore: &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   "test-ds",
							Info: plugins.Info{Version: "1.0.0"},
						},
					},
				},
			},
			updateCheckURL: updateCheckURL,
		}

		update, exists := svc.HasUpdate(context.Background(), "test-panel")
		require.False(t, exists)
		require.Empty(t, update)

		update, exists = svc.HasUpdate(context.Background(), "test-ds")
		require.False(t, exists)
		require.Empty(t, update)
	})
}

func TestPluginUpdateChecker_checkForUpdates(t *testing.T) {
	t.Run("update is available", func(t *testing.T) {
		jsonResp := `[
		  {
			"slug": "test-ds",
			"version": "1.0.12"
		  },
		  {
			"slug": "test-panel",
			"version": "2.5.7"
		  },
		  {
			"slug": "test-core-panel",
			"version": "1.0.0"
		  }
		]`

		updateCheckURL, _ := url.Parse("https://grafana.com/api/plugins/versioncheck")

		svc := PluginsService{
			availableUpdates: map[string]availableUpdate{
				"test-app": {
					localVersion:     "0.5.0",
					availableVersion: "1.0.0",
				},
			},
			pluginStore: &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   "test-ds",
							Info: plugins.Info{Version: "0.9.0"},
							Type: plugins.TypeDataSource,
						},
						Class: plugins.ClassExternal,
					},
					{
						JSONData: plugins.JSONData{
							ID:   "test-app",
							Info: plugins.Info{Version: "0.5.0"},
							Type: plugins.TypeApp,
						},
						Class: plugins.ClassExternal,
					},
					{
						JSONData: plugins.JSONData{
							ID:   "test-panel",
							Info: plugins.Info{Version: "2.5.7"},
							Type: plugins.TypePanel,
						},
						Class: plugins.ClassExternal,
					},
					{
						JSONData: plugins.JSONData{
							ID:   "test-core-panel",
							Info: plugins.Info{Version: "0.0.1"},
							Type: plugins.TypePanel,
						},
						Class: plugins.ClassCore,
					},
				},
			},
			httpClient: &fakeHTTPClient{
				fakeResp: jsonResp,
			},
			log:            log.NewNopLogger(),
			tracer:         tracing.InitializeTracerForTest(),
			updateCheckURL: updateCheckURL,
			updateChecker:  pluginchecker.ProvideService(managedplugins.NewNoop(), provisionedplugins.NewNoop(), &mockPluginPreinstall{}),
			features:       &featuremgmt.FeatureManager{},
		}

		svc.instrumentedCheckForUpdates(context.Background())

		require.Equal(t, 1, len(svc.availableUpdates))

		require.Equal(t, "1.0.12", svc.availableUpdates["test-ds"].availableVersion)
		update, exists := svc.HasUpdate(context.Background(), "test-ds")
		require.True(t, exists)
		require.Equal(t, "1.0.12", update)

		require.Empty(t, svc.availableUpdates["test-app"])
		update, exists = svc.HasUpdate(context.Background(), "test-app")
		require.False(t, exists)
		require.Empty(t, update)

		require.Empty(t, svc.availableUpdates["test-panel"])
		update, exists = svc.HasUpdate(context.Background(), "test-panel")
		require.False(t, exists)
		require.Empty(t, update)

		require.Empty(t, svc.availableUpdates["test-core-panel"])
	})
}

func TestPluginUpdateChecker_updateAll(t *testing.T) {
	t.Run("update is available", func(t *testing.T) {
		pluginsFakeStore := map[string]string{}
		availableUpdates := map[string]availableUpdate{
			"test-app-0": {
				localVersion:     "0.9.0",
				availableVersion: "1.0.0",
			},
			"test-app-1": {
				localVersion:     "0.9.0",
				availableVersion: "1.0.0",
			},
			"test-app-2": {
				localVersion:     "0.9.0",
				availableVersion: "1.0.0",
			},
		}

		svc := PluginsService{
			availableUpdates: availableUpdates,
			log:              log.NewNopLogger(),
			tracer:           tracing.InitializeTracerForTest(),
			pluginInstaller: &pluginfakes.FakePluginInstaller{
				AddFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) error {
					pluginsFakeStore[pluginID] = version
					return nil
				},
				RemoveFunc: func(ctx context.Context, pluginID, version string) error {
					delete(pluginsFakeStore, pluginID)
					return nil
				},
			},
		}

		svc.updateAll(context.Background())

		require.Equal(t, 0, len(svc.availableUpdates))
		require.Equal(t, len(availableUpdates), len(pluginsFakeStore))

		for pluginID, availableUpdate := range availableUpdates {
			require.Equal(t, availableUpdate.availableVersion, pluginsFakeStore[pluginID])
		}
	})
}

type fakeHTTPClient struct {
	fakeResp string

	requestURL string
}

func (c *fakeHTTPClient) Do(req *http.Request) (*http.Response, error) {
	c.requestURL = req.URL.String()

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(c.fakeResp)),
	}

	return resp, nil
}

func TestPluginsService_PluginsAutoUpdateFlag(t *testing.T) {
	updateCheckURL, _ := url.Parse("https://grafana.com/api/plugins/versioncheck")

	tests := []struct {
		name         string
		flagEnabled  bool
		expectUpdate bool
	}{
		{
			name:         "pluginsAutoUpdate enabled calls updateAll",
			flagEnabled:  true,
			expectUpdate: true,
		},
		{
			name:         "pluginsAutoUpdate disabled does not call updateAll",
			flagEnabled:  false,
			expectUpdate: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureProvider(t, tt.flagEnabled)

			updateCallCount := 0

			availableUpdates := map[string]availableUpdate{
				"test-plugin": {
					localVersion:     "0.9.0",
					availableVersion: "1.0.0",
				},
			}

			svc := &PluginsService{
				availableUpdates: availableUpdates,
				httpClient: &fakeHTTPClient{
					fakeResp: `[]`,
				},
				log:            log.NewNopLogger(),
				tracer:         tracing.InitializeTracerForTest(),
				updateCheckURL: updateCheckURL,
				updateChecker:  pluginchecker.ProvideService(managedplugins.NewNoop(), provisionedplugins.NewNoop(), &mockPluginPreinstall{}),
				pluginStore:    &pluginstore.FakePluginStore{PluginList: []pluginstore.Plugin{}},
				pluginInstaller: &pluginfakes.FakePluginInstaller{
					AddFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) error {
						updateCallCount++
						return nil
					},
				},
				grafanaVersion: "10.0.0",
			}

			ctx := context.Background()
			// Test the synchronous initialization work directly, without the long-running ticker loop
			svc.checkAndUpdate(ctx)

			if tt.expectUpdate {
				require.Equal(t, updateCallCount, 1, "updateAll should be called when flag is enabled")
			} else {
				require.Equal(t, 0, updateCallCount, "updateAll should not be called when flag is disabled")
			}
		})
	}
}

var openfeatureTestMutex sync.Mutex

func setupOpenFeatureProvider(t *testing.T, flagValue bool) {
	t.Helper()
	openfeatureTestMutex.Lock()

	err := featuremgmt.InitOpenFeature(featuremgmt.OpenFeatureConfig{
		ProviderType: setting.StaticProviderType,
		StaticFlags: map[string]bool{
			featuremgmt.FlagPluginsAutoUpdate: flagValue,
		},
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})
}
