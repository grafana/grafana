package manager_test

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/managertest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestPluginManager_int_init(t *testing.T) {
	t.Helper()

	grafanaRootPath, err := filepath.Abs("../../../")
	require.NoError(t, err)

	pm, err := managertest.ProvidePluginManager(t, managertest.PluginManagerOpts{
		SQLStore:        sqlstore.InitTestDB(t),
		GrafanaRootPath: grafanaRootPath,
	})
	require.NoError(t, err)

	ctx := context.Background()
	verifyCorePluginCatalogue(t, ctx, pm)
	verifyBundledPlugins(t, ctx, pm)
	verifyPluginStaticRoutes(t, ctx, pm)
}

func verifyCorePluginCatalogue(t *testing.T, ctx context.Context, pm *manager.PluginManager) {
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
		"heatmap-old":    {},
		"histogram":      {},
		"icon":           {},
		"live":           {},
		"logs":           {},
		"candlestick":    {},
		"news":           {},
		"nodeGraph":      {},
		"traces":         {},
		"piechart":       {},
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
		"cloudwatch":                       {},
		"stackdriver":                      {},
		"grafana-azure-monitor-datasource": {},
		"elasticsearch":                    {},
		"graphite":                         {},
		"influxdb":                         {},
		"loki":                             {},
		"opentsdb":                         {},
		"prometheus":                       {},
		"tempo":                            {},
		"testdata":                         {},
		"postgres":                         {},
		"mysql":                            {},
		"mssql":                            {},
		"grafana":                          {},
		"alertmanager":                     {},
		"dashboard":                        {},
		"input":                            {},
		"jaeger":                           {},
		"mixed":                            {},
		"zipkin":                           {},
	}

	expApps := map[string]struct{}{
		"test-app": {},
	}

	panels := pm.Plugins(ctx, plugins.Panel)
	assert.Equal(t, len(expPanels), len(panels))
	for _, p := range panels {
		p, exists := pm.Plugin(ctx, p.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expPanels, p.ID)
	}

	dataSources := pm.Plugins(ctx, plugins.DataSource)
	assert.Equal(t, len(expDataSources), len(dataSources))
	for _, ds := range dataSources {
		p, exists := pm.Plugin(ctx, ds.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expDataSources, ds.ID)
	}

	apps := pm.Plugins(ctx, plugins.App)
	assert.Equal(t, len(expApps), len(apps))
	for _, app := range apps {
		p, exists := pm.Plugin(ctx, app.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expApps, app.ID)
	}

	assert.Equal(t, len(expPanels)+len(expDataSources)+len(expApps), len(pm.Plugins(ctx)))
}

func verifyBundledPlugins(t *testing.T, ctx context.Context, pm *manager.PluginManager) {
	t.Helper()

	dsPlugins := make(map[string]struct{})
	for _, p := range pm.Plugins(ctx, plugins.DataSource) {
		dsPlugins[p.ID] = struct{}{}
	}

	pluginRoutes := make(map[string]*plugins.StaticRoute)
	for _, r := range pm.Routes() {
		pluginRoutes[r.PluginID] = r
	}

	inputPlugin, exists := pm.Plugin(ctx, "input")
	require.NotEqual(t, plugins.PluginDTO{}, inputPlugin)
	assert.True(t, exists)
	assert.NotNil(t, dsPlugins["input"])

	for _, pluginID := range []string{"input"} {
		assert.Contains(t, pluginRoutes, pluginID)
		assert.True(t, strings.HasPrefix(pluginRoutes[pluginID].Directory, inputPlugin.PluginDir))
	}
}

func verifyPluginStaticRoutes(t *testing.T, ctx context.Context, pm *manager.PluginManager) {
	routes := make(map[string]*plugins.StaticRoute)
	for _, route := range pm.Routes() {
		routes[route.PluginID] = route
	}

	assert.Len(t, routes, 2)

	inputPlugin, _ := pm.Plugin(ctx, "input")
	assert.NotNil(t, routes["input"])
	assert.Equal(t, routes["input"].Directory, inputPlugin.PluginDir)

	testAppPlugin, _ := pm.Plugin(ctx, "test-app")
	assert.Contains(t, routes, "test-app")
	assert.Equal(t, routes["test-app"].Directory, testAppPlugin.PluginDir)
}
