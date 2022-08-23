package manager

import (
	"context"
	"net/http"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor"
	"github.com/grafana/grafana/pkg/tsdb/cloudmonitoring"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/tsdb/graphite"
	"github.com/grafana/grafana/pkg/tsdb/influxdb"
	"github.com/grafana/grafana/pkg/tsdb/loki"
	"github.com/grafana/grafana/pkg/tsdb/mssql"
	"github.com/grafana/grafana/pkg/tsdb/mysql"
	"github.com/grafana/grafana/pkg/tsdb/opentsdb"
	"github.com/grafana/grafana/pkg/tsdb/postgres"
	"github.com/grafana/grafana/pkg/tsdb/prometheus"
	"github.com/grafana/grafana/pkg/tsdb/tempo"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
)

func TestPluginManager_int_init(t *testing.T) {
	t.Helper()

	staticRootPath, err := filepath.Abs("../../../public/")
	require.NoError(t, err)

	bundledPluginsPath, err := filepath.Abs("../../../plugins-bundled/internal")
	require.NoError(t, err)

	features := featuremgmt.WithFeatures()
	cfg := &setting.Cfg{
		Raw:                    ini.Empty(),
		Env:                    setting.Prod,
		StaticRootPath:         staticRootPath,
		BundledPluginsPath:     bundledPluginsPath,
		IsFeatureToggleEnabled: features.IsEnabled,
		PluginSettings: map[string]map[string]string{
			"plugin.datasource-id": {
				"path": "testdata/test-app",
			},
		},
	}

	tracer := &fakeTracer{}

	license := &licensing.OSSLicensingService{
		Cfg: cfg,
	}

	hcp := httpclient.NewProvider()
	am := azuremonitor.ProvideService(cfg, hcp, tracer)
	cw := cloudwatch.ProvideService(cfg, hcp, features)
	cm := cloudmonitoring.ProvideService(hcp, tracer)
	es := elasticsearch.ProvideService(hcp)
	grap := graphite.ProvideService(hcp, tracer)
	idb := influxdb.ProvideService(hcp)
	lk := loki.ProvideService(hcp, features, tracer)
	otsdb := opentsdb.ProvideService(hcp)
	pr := prometheus.ProvideService(hcp, cfg, features, tracer)
	tmpo := tempo.ProvideService(hcp)
	td := testdatasource.ProvideService(cfg, features)
	pg := postgres.ProvideService(cfg)
	my := mysql.ProvideService(cfg, hcp)
	ms := mssql.ProvideService(cfg)
	sv2 := searchV2.ProvideService(cfg, sqlstore.InitTestDB(t), nil, nil)
	graf := grafanads.ProvideService(cfg, sv2, nil)

	coreRegistry := coreplugin.ProvideCoreRegistry(am, cw, cm, es, grap, idb, lk, otsdb, pr, tmpo, td, pg, my, ms, graf)

	pmCfg := plugins.FromGrafanaCfg(cfg)
	pm, err := ProvideService(cfg, registry.NewInMemory(), loader.New(pmCfg, license, signature.NewUnsignedAuthorizer(pmCfg),
		provider.ProvideService(coreRegistry)), nil)
	require.NoError(t, err)

	ctx := context.Background()
	verifyCorePluginCatalogue(t, ctx, pm)
	verifyBundledPlugins(t, ctx, pm)
	verifyPluginStaticRoutes(t, ctx, pm)
}

func verifyCorePluginCatalogue(t *testing.T, ctx context.Context, pm *PluginManager) {
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
		assert.Contains(t, pm.registeredPlugins(ctx), p.ID)
	}

	dataSources := pm.Plugins(ctx, plugins.DataSource)
	assert.Equal(t, len(expDataSources), len(dataSources))
	for _, ds := range dataSources {
		p, exists := pm.Plugin(ctx, ds.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expDataSources, ds.ID)
		assert.Contains(t, pm.registeredPlugins(ctx), ds.ID)
	}

	apps := pm.Plugins(ctx, plugins.App)
	assert.Equal(t, len(expApps), len(apps))
	for _, app := range apps {
		p, exists := pm.Plugin(ctx, app.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expApps, app.ID)
		assert.Contains(t, pm.registeredPlugins(ctx), app.ID)
	}

	assert.Equal(t, len(expPanels)+len(expDataSources)+len(expApps), len(pm.Plugins(ctx)))
}

func verifyBundledPlugins(t *testing.T, ctx context.Context, pm *PluginManager) {
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

func verifyPluginStaticRoutes(t *testing.T, ctx context.Context, pm *PluginManager) {
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

type fakeTracer struct {
	tracing.Tracer
}

func (ft *fakeTracer) Run(context.Context) error {
	return nil
}

func (ft *fakeTracer) Start(ctx context.Context, _ string, _ ...trace.SpanStartOption) (context.Context, tracing.Span) {
	return ctx, nil
}

func (ft *fakeTracer) Inject(context.Context, http.Header, tracing.Span) {

}
