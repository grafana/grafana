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

	panels := map[string]struct{}{
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

	dataSources := map[string]struct{}{
		"alertmanager": {},
		"dashboard":    {},
		"input":        {},
		"jaeger":       {},
		"mixed":        {},
		"zipkin":       {},
	}

	pluginRoutes := make(map[string]*plugins.StaticRoute)
	for _, route := range pm.Routes() {
		pluginRoutes[route.PluginID] = route
	}

	for _, p := range pm.Plugins(plugins.Panel) {
		require.NotNil(t, pm.Plugin(p.ID))
		assert.Contains(t, panels, p.ID)
		assert.Contains(t, pm.registeredPlugins(), p.ID)
		assert.Contains(t, pluginRoutes, p.ID)
		assert.Equal(t, pluginRoutes[p.ID].Directory, p.PluginDir)
	}

	for _, ds := range pm.Plugins(plugins.DataSource) {
		require.NotNil(t, pm.Plugin(ds.ID))
		assert.Contains(t, dataSources, ds.ID)
		assert.Contains(t, pm.registeredPlugins(), ds.ID)
		assert.Contains(t, pluginRoutes, ds.ID)
		assert.Equal(t, pluginRoutes[ds.ID].Directory, ds.PluginDir)
	}
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

	for _, pluginID := range []string{
		"input",
	} {
		assert.Contains(t, pluginRoutes, pluginID)
		assert.True(t, strings.HasPrefix(pluginRoutes[pluginID].Directory, pm.Plugin("input").PluginDir))
	}
}
