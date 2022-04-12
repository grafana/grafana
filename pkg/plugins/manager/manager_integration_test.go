package manager

import (
	"context"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/manager/installer"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
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
	"go.opentelemetry.io/otel/trace"

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
	cw := cloudwatch.ProvideService(cfg, hcp)
	cm := cloudmonitoring.ProvideService(hcp, tracer)
	es := elasticsearch.ProvideService(hcp)
	grap := graphite.ProvideService(hcp, tracer)
	idb := influxdb.ProvideService(hcp)
	lk := loki.ProvideService(hcp, tracer)
	otsdb := opentsdb.ProvideService(hcp)
	pr := prometheus.ProvideService(hcp, cfg, features, tracer)
	tmpo := tempo.ProvideService(hcp)
	td := testdatasource.ProvideService(cfg, features)
	pg := postgres.ProvideService(cfg)
	my := mysql.ProvideService(cfg, hcp)
	ms := mssql.ProvideService(cfg)
	sv2 := searchV2.ProvideService(sqlstore.InitTestDB(t))
	graf := grafanads.ProvideService(cfg, sv2, nil)
	coreRegistry := coreplugin.ProvideCoreRegistry(am, cw, cm, es, grap, idb, lk, otsdb, pr, tmpo, td, pg, my, ms, graf)

	pmCfg := plugins.FromGrafanaCfg(cfg)

	pluginRegistry := registry.NewPluginRegistry(pmCfg)

	pm, err := ProvideService(cfg, registry.NewInMemory(pmCfg), loader.New(pmCfg, license, signature.NewUnsignedAuthorizer(pmCfg),
		provider.ProvideService(coreRegistry)), installer.ProvideService(cfg), process.ProvideProcessManager(pluginRegistry))
	require.NoError(t, err)

	pluginStore := store.ProvideService(pm.pluginRegistry)

	verifyCorePluginCatalogue(t, pluginStore)
	verifyBundledPlugins(t, pluginStore)
}

func verifyCorePluginCatalogue(t *testing.T, pm plugins.Store) {
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
		"heatmap-new":    {},
		"histogram":      {},
		"icon":           {},
		"live":           {},
		"logs":           {},
		"candlestick":    {},
		"news":           {},
		"nodeGraph":      {},
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

	panels := pm.Plugins(context.Background(), plugins.Panel)
	assert.Equal(t, len(expPanels), len(panels))
	for _, p := range panels {
		p, exists := pm.Plugin(context.Background(), p.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expPanels, p.ID)
	}

	dataSources := pm.Plugins(context.Background(), plugins.DataSource)
	assert.Equal(t, len(expDataSources), len(dataSources))
	for _, ds := range dataSources {
		p, exists := pm.Plugin(context.Background(), ds.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expDataSources, ds.ID)
	}

	apps := pm.Plugins(context.Background(), plugins.App)
	assert.Equal(t, len(expApps), len(apps))
	for _, app := range apps {
		p, exists := pm.Plugin(context.Background(), app.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		assert.True(t, exists)
		assert.Contains(t, expApps, app.ID)
	}

	assert.Equal(t, len(expPanels)+len(expDataSources)+len(expApps), len(pm.Plugins(context.Background())))
}

func verifyBundledPlugins(t *testing.T, pm plugins.Store) {
	t.Helper()

	dsPlugins := make(map[string]struct{})
	for _, p := range pm.Plugins(context.Background(), plugins.DataSource) {
		dsPlugins[p.ID] = struct{}{}
	}

	inputPlugin, exists := pm.Plugin(context.Background(), "input")
	require.NotEqual(t, plugins.PluginDTO{}, inputPlugin)
	assert.True(t, exists)
	assert.NotNil(t, dsPlugins["input"])
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
