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

	panels := []string{
		"alertlist",
		"alertGroups",
		"annolist",
		"barchart",
		"bargauge",
		"canvas",
		"dashlist",
		"debug",
		"gauge",
		"geomap",
		"gettingstarted",
		"graph",
		"heatmap",
		"live",
		"logs",
		"news",
		"nodeGraph",
		"piechart",
		"pluginlist",
		"stat",
		"table",
		"table-old",
		"text",
		"timeseries",
		"state-timeline",
		"status-history",
		"timeseries",
		"welcome",
		"xychart",
	}

	dataSources := []string{
		"alertmanager",
		"dashboard",
		"jaeger",
		"mixed",
		"zipkin",
		"input",
	}

	panelPlugins := make(map[string]struct{})
	for _, p := range pm.Plugins(plugins.Panel) {
		panelPlugins[p.ID] = struct{}{}
	}

	dsPlugins := make(map[string]struct{})
	for _, p := range pm.Plugins(plugins.DataSource) {
		dsPlugins[p.ID] = struct{}{}
	}

	pluginRoutes := make(map[string]*plugins.StaticRoute)
	for _, r := range pm.Routes() {
		pluginRoutes[r.PluginID] = r
	}

	for _, p := range panels {
		require.NotNil(t, pm.Plugin(p))
		assert.Contains(t, panelPlugins, p)
		assert.Contains(t, pm.registeredPlugins(), p)
		assert.Contains(t, pluginRoutes, p)
		assert.True(t, strings.HasPrefix(pluginRoutes[p].Directory, pm.Plugin(p).PluginDir))
	}
	assert.Equal(t, len(pm.Plugins(plugins.Panel)), len(panels))

	for _, ds := range dataSources {
		require.NotNil(t, pm.Plugin(ds))
		assert.Contains(t, dsPlugins, ds)
		assert.Contains(t, pm.registeredPlugins(), ds)
		assert.Contains(t, pluginRoutes, ds)
		assert.True(t, strings.HasPrefix(pluginRoutes[ds].Directory, pm.Plugin(ds).PluginDir))
	}
	assert.Equal(t, len(pm.Plugins(plugins.DataSource)), len(dataSources))
	assert.Equal(t, len(pm.Plugins(plugins.DataSource))+len(pm.Plugins(plugins.Panel)), len(pm.Routes()))
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

	for pluginID, pluginDir := range map[string]string{
		"input": "input-datasource",
	} {
		assert.Contains(t, pluginRoutes, pluginID)
		assert.True(t, strings.HasPrefix(pluginRoutes[pluginID].Directory, pm.cfg.BundledPluginsPath+"/"+pluginDir))
	}
}
