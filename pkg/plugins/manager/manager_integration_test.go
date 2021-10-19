package manager

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
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
	pm := newManager(cfg, license, nil, nil)

	err = pm.init()
	require.NoError(t, err)

	verifyCorePluginCatalogue(t, pm)
	verifyBundledPlugins(t, pm)
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

	pluginRoutes := make(map[string]*plugins.StaticRoute)
	for _, route := range pm.Routes() {
		pluginRoutes[route.PluginID] = route
	}

	panels := pm.Plugins(plugins.Panel)
	assert.Equal(t, len(expPanels), len(panels))
	for _, p := range panels {
		require.NotNil(t, pm.Plugin(p.ID))
		assert.Contains(t, expPanels, p.ID)
		assert.Contains(t, pm.registeredPlugins(), p.ID)
		assert.Contains(t, pluginRoutes, p.ID)
		assert.Equal(t, pluginRoutes[p.ID].Directory, p.PluginDir)
	}

	dataSources := pm.Plugins(plugins.DataSource)
	assert.Equal(t, len(expDataSources), len(dataSources))
	for _, ds := range dataSources {
		require.NotNil(t, pm.Plugin(ds.ID))
		assert.Contains(t, expDataSources, ds.ID)
		assert.Contains(t, pm.registeredPlugins(), ds.ID)
		assert.Contains(t, pluginRoutes, ds.ID)
		assert.Equal(t, pluginRoutes[ds.ID].Directory, ds.PluginDir)
	}

	apps := pm.Plugins(plugins.App)
	assert.Equal(t, len(expApps), len(apps))
	for _, app := range apps {
		require.NotNil(t, pm.Plugin(app.ID))
		require.Contains(t, expApps, app.ID)
		assert.Contains(t, pm.registeredPlugins(), app.ID)
		assert.Contains(t, pluginRoutes, app.ID)
		assert.Equal(t, pluginRoutes[app.ID].Directory, app.PluginDir)
	}

	assert.Equal(t, len(expPanels)+len(expDataSources)+len(expApps), len(pm.Plugins()))
}

func verifyBundledPlugins(t *testing.T, pm *PluginManager) {
	t.Helper()

	dsPlugins := make(map[string]struct{})
	for _, p := range pm.Plugins(plugins.DataSource) {
		dsPlugins[p.ID] = struct{}{}
	}

	pluginRoutes := make(map[string]*plugins.StaticRoute)
	for _, r := range pm.Routes() {
		pluginRoutes[r.PluginID] = r
	}

	assert.NotNil(t, pm.Plugin("input"))
	assert.NotNil(t, dsPlugins["input"])

	for _, pluginID := range []string{"input"} {
		assert.Contains(t, pluginRoutes, pluginID)
		assert.True(t, strings.HasPrefix(pluginRoutes[pluginID].Directory, pm.Plugin("input").PluginDir))
	}
}
