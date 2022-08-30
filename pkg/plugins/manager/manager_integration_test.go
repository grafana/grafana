package manager

import (
	"context"
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
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
)

func TestIntegrationPluginManager_Run(t *testing.T) {
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
			"plugin.test-app": {
				"path": "testdata/test-app",
			},
			"plugin.test-panel": {
				"not": "included",
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
	reg := registry.ProvideService()
	pm, err := ProvideService(cfg, reg, loader.New(pmCfg, license, signature.NewUnsignedAuthorizer(pmCfg),
		provider.ProvideService(coreRegistry)), nil)
	require.NoError(t, err)
	ps := store.ProvideService(reg)

	ctx := context.Background()
	verifyCorePluginCatalogue(t, ctx, ps)
	verifyBundledPlugins(t, ctx, ps)
	verifyPluginStaticRoutes(t, ctx, ps)
	verifyBackendProcesses(t, pm.pluginRegistry.Plugins(ctx))
	verifyPluginQuery(t, ctx, client.ProvideService(reg))
}

func verifyPluginQuery(t *testing.T, ctx context.Context, c plugins.Client) {
	now := time.Unix(1661420870, 0)
	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			PluginID: "testdata",
		},
		Queries: []backend.DataQuery{
			{
				RefID: "A",
				TimeRange: backend.TimeRange{
					From: now.Add(-5 * time.Minute),
					To:   now,
				},
				JSON: json.RawMessage(`{"scenarioId":"csv_metric_values","stringInput":"1,20,90,30,5,0"}`),
			},
		},
	}

	resp, err := c.QueryData(ctx, req)
	require.NoError(t, err)
	payload, err := resp.MarshalJSON()
	require.NoError(t, err)
	require.JSONEq(t, `{"results":{"A":{"frames":[{"schema":{"refId":"A","fields":[{"name":"time","type":"time","typeInfo":{"frame":"time.Time"}},{"name":"A-series","type":"number","typeInfo":{"frame":"int64","nullable":true}}]},"data":{"values":[[1661420570000,1661420630000,1661420690000,1661420750000,1661420810000,1661420870000],[1,20,90,30,5,0]]}}]}}}`, string(payload))
}

func verifyCorePluginCatalogue(t *testing.T, ctx context.Context, ps *store.Service) {
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

	panels := ps.Plugins(ctx, plugins.Panel)
	require.Equal(t, len(expPanels), len(panels))
	for _, p := range panels {
		p, exists := ps.Plugin(ctx, p.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		require.True(t, exists)
		require.Contains(t, expPanels, p.ID)
	}

	dataSources := ps.Plugins(ctx, plugins.DataSource)
	require.Equal(t, len(expDataSources), len(dataSources))
	for _, ds := range dataSources {
		p, exists := ps.Plugin(ctx, ds.ID)
		require.NotEqual(t, plugins.PluginDTO{}, p)
		require.True(t, exists)
		require.Contains(t, expDataSources, ds.ID)
	}

	apps := ps.Plugins(ctx, plugins.App)
	require.Equal(t, len(expApps), len(apps))
	for _, app := range apps {
		p, exists := ps.Plugin(ctx, app.ID)
		require.True(t, exists)
		require.NotNil(t, p)
		require.Contains(t, expApps, app.ID)
	}

	require.Equal(t, len(expPanels)+len(expDataSources)+len(expApps), len(ps.Plugins(ctx)))
}

func verifyBundledPlugins(t *testing.T, ctx context.Context, ps *store.Service) {
	t.Helper()

	dsPlugins := make(map[string]struct{})
	for _, p := range ps.Plugins(ctx, plugins.DataSource) {
		dsPlugins[p.ID] = struct{}{}
	}

	inputPlugin, exists := ps.Plugin(ctx, "input")
	require.True(t, exists)
	require.NotEqual(t, plugins.PluginDTO{}, inputPlugin)
	require.NotNil(t, dsPlugins["input"])

	pluginRoutes := make(map[string]*plugins.StaticRoute)
	for _, r := range ps.Routes() {
		pluginRoutes[r.PluginID] = r
	}

	for _, pluginID := range []string{"input"} {
		require.Contains(t, pluginRoutes, pluginID)
		require.True(t, strings.HasPrefix(pluginRoutes[pluginID].Directory, inputPlugin.PluginDir))
	}
}

func verifyPluginStaticRoutes(t *testing.T, ctx context.Context, ps *store.Service) {
	routes := make(map[string]*plugins.StaticRoute)
	for _, route := range ps.Routes() {
		routes[route.PluginID] = route
	}

	require.Len(t, routes, 2)

	inputPlugin, _ := ps.Plugin(ctx, "input")
	require.NotNil(t, routes["input"])
	require.Equal(t, routes["input"].Directory, inputPlugin.PluginDir)

	testAppPlugin, _ := ps.Plugin(ctx, "test-app")
	require.Contains(t, routes, "test-app")
	require.Equal(t, routes["test-app"].Directory, testAppPlugin.PluginDir)
}

func verifyBackendProcesses(t *testing.T, ps []*plugins.Plugin) {
	for _, p := range ps {
		if p.Backend {
			pc, exists := p.Client()
			require.True(t, exists)
			require.NotNil(t, pc)
		}
	}
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
