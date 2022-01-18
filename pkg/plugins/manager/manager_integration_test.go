package manager

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gopkg.in/ini.v1"
)

func TestPluginManager_int_init(t *testing.T) {
	t.Helper()

	staticRootPath, err := filepath.Abs("../../../public/")
	require.NoError(t, err)

	bundledPluginsPath, err := filepath.Abs("../../../plugins-bundled/internal")
	require.NoError(t, err)

	cfg := &setting.Cfg{
		Raw:                ini.Empty(),
		Env:                setting.Prod,
		StaticRootPath:     staticRootPath,
		BundledPluginsPath: bundledPluginsPath,
		PluginSettings: map[string]map[string]string{
			"plugin.datasource-id": {
				"path": "testdata/test-app",
			},
		},
	}

	license := &licensing.OSSLicensingService{
		Cfg: cfg,
	}

	pmCfg := plugins.FromGrafanaCfg(cfg)
	pm, err := ProvideService(cfg, nil, loader.New(pmCfg, license,
		&signature.UnsignedPluginAuthorizer{Cfg: pmCfg}, &provider.Service{}), nil)
	require.NoError(t, err)

	verifyCorePluginCatalogue(t, pm)
	verifyBundledPlugins(t, pm)
	verifyPluginStaticRoutes(t, pm)
}

func verifyCorePluginCatalogue(t *testing.T, pm *PluginManager) {
	t.Helper()

	expPanels := map[string]struct{}{
		"alertGroups":    {},
		"alertlist":      {},
		"annolist":       {},
		"barchart":       {},
		"bargauge":       {},
		"canvas":         {},
		"dashlist":       {},
		"debug":          {},
		"gauge":          {},
		"geomap":         {},
		"gettingstarted": {},
		"graph":          {},
		"heatmap":        {},
		"histogram":      {},
		"icon":           {},
		"live":           {},
		"logs":           {},
		"candlestick":    {},
		"news":           {},
		"nodeGraph":      {},
		"piechart":       {},
		"pluginlist":     {},
		"stat":           {},
		"state-timeline": {},
		"status-history": {},
		"table":          {},
		"table-old":      {},
		"text":           {},
		"timeseries":     {},
		"welcome":        {},
		"xychart":        {},
	}

	expDataSources := map[string]struct{}{
		"alertmanager": {},
		"dashboard":    {},
		"input":        {},
		"jaeger":       {},
		"mixed":        {},
		"zipkin":       {},
	}

	expApps := map[string]struct{}{
		"test-app": {},
	}

	panels := pm.Plugins(context.Background(), plugins.Panel)
	assert.Equal(t, len(expPanels), len(panels))
	for _, p := range panels {
		p, exists := pm.Plugin(context.Background(), p.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expPanels, p.ID)
		assert.Contains(t, pm.registeredPlugins(), p.ID)
	}

	dataSources := pm.Plugins(context.Background(), plugins.DataSource)
	assert.Equal(t, len(expDataSources), len(dataSources))
	for _, ds := range dataSources {
		p, exists := pm.Plugin(context.Background(), ds.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expDataSources, ds.ID)
		assert.Contains(t, pm.registeredPlugins(), ds.ID)
	}

	apps := pm.Plugins(context.Background(), plugins.App)
	assert.Equal(t, len(expApps), len(apps))
	for _, app := range apps {
		p, exists := pm.Plugin(context.Background(), app.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expApps, app.ID)
		assert.Contains(t, pm.registeredPlugins(), app.ID)
	}

	assert.Equal(t, len(expPanels)+len(expDataSources)+len(expApps), len(pm.Plugins(context.Background())))
}

func verifyBundledPlugins(t *testing.T, pm *PluginManager) {
	t.Helper()

	dsPlugins := make(map[string]struct{})
	for _, p := range pm.Plugins(context.Background(), plugins.DataSource) {
		dsPlugins[p.ID] = struct{}{}
	}

	pluginRoutes := make(map[string]*plugins.StaticRoute)
	for _, r := range pm.Routes() {
		pluginRoutes[r.PluginID] = r
	}

	inputPlugin, exists := pm.Plugin(context.Background(), "input")
	require.NotEqual(t, plugins.PluginDTO{}, inputPlugin)
	assert.True(t, exists)
	assert.NotNil(t, dsPlugins["input"])

	for _, pluginID := range []string{"input"} {
		assert.Contains(t, pluginRoutes, pluginID)
		assert.True(t, strings.HasPrefix(pluginRoutes[pluginID].Directory, inputPlugin.PluginDir))
	}
}

func verifyPluginStaticRoutes(t *testing.T, pm *PluginManager) {
	routes := make(map[string]*plugins.StaticRoute)
	for _, route := range pm.Routes() {
		routes[route.PluginID] = route
	}

	assert.Len(t, routes, 2)

	inputPlugin, _ := pm.Plugin(context.Background(), "input")
	assert.NotNil(t, routes["input"])
	assert.Equal(t, routes["input"].Directory, inputPlugin.PluginDir)

	testAppPlugin, _ := pm.Plugin(context.Background(), "test-app")
	assert.Contains(t, routes, "test-app")
	assert.Equal(t, routes["test-app"].Directory, testAppPlugin.PluginDir)
}
