package plugintest

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor"
	cloudmonitoring "github.com/grafana/grafana/pkg/tsdb/cloud-monitoring"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch"
	postgres "github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource"
	pyroscope "github.com/grafana/grafana/pkg/tsdb/grafana-pyroscope-datasource"
	testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/tsdb/graphite"
	"github.com/grafana/grafana/pkg/tsdb/influxdb"
	"github.com/grafana/grafana/pkg/tsdb/jaeger"
	"github.com/grafana/grafana/pkg/tsdb/loki"
	"github.com/grafana/grafana/pkg/tsdb/mssql"
	"github.com/grafana/grafana/pkg/tsdb/mysql"
	"github.com/grafana/grafana/pkg/tsdb/opentsdb"
	"github.com/grafana/grafana/pkg/tsdb/parca"
	"github.com/grafana/grafana/pkg/tsdb/prometheus"
	"github.com/grafana/grafana/pkg/tsdb/tempo"
	"github.com/grafana/grafana/pkg/tsdb/zipkin"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// This test should run before TestIntegrationPluginManager because this test relies on having a pre-existing Admin user
// and because the SQLStore instance is shared between tests, this test does all the necessary setup
func TestIntegrationPluginDashboards(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		AnonymousUserRole: org.RoleAdmin,
	})

	appProvisioningPath := filepath.Join(".", "testdata", "provisioning", "apps.yaml")
	err := fs.CopyRecursive(appProvisioningPath, filepath.Join(dir, "conf", "provisioning", "plugins", "apps.yaml"))
	require.NoError(t, err)

	pluginPath := filepath.Join("testdata", "test-app")
	err = fs.CopyRecursive(pluginPath, filepath.Join(dir, "plugins", "test-app"))
	require.NoError(t, err)

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

	t.Run("Load plugin and test HTTP API", func(t *testing.T) {
		resp, err := http.Get(fmt.Sprintf("http://%s/public/plugins/test-app/dashboards/dashboard.json", grafanaListedAddr))
		require.NoError(t, err)
		require.NotNil(t, resp)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Get(fmt.Sprintf("http://%s/api/plugins/test-app/settings", grafanaListedAddr))
		require.NoError(t, err)
		require.NotNil(t, resp)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Get(fmt.Sprintf("http://%s/api/plugins/test-app/dashboards", grafanaListedAddr))
		require.NoError(t, err)
		require.NotNil(t, resp)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		resp, err = http.Post(fmt.Sprintf("http://admin:admin@%s/api/admin/provisioning/plugins/reload", grafanaListedAddr), "", nil)
		require.NoError(t, err)
		require.NotNil(t, resp)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Get(fmt.Sprintf("http://admin:admin@%s/api/dashboards/uid/wiwhfsg", grafanaListedAddr))
		require.NoError(t, err)
		require.NotNil(t, resp)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestIntegrationPluginManager(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	staticRootPath, err := filepath.Abs("../../../../public/")
	require.NoError(t, err)

	// We use the raw config here as it forms the basis for the setting.Provider implementation
	// The plugin manager also relies directly on the setting.Cfg struct to provide Grafana specific
	// properties such as the loading paths
	raw, err := ini.Load([]byte(`
		app_mode = production

		[plugin.test-app]
		path=../../../plugins/manager/testdata/test-app

		[plugin.test-panel]
		not=included
		`),
	)
	require.NoError(t, err)

	features := featuremgmt.WithFeatures()
	cfg := &setting.Cfg{
		Raw:            raw,
		StaticRootPath: staticRootPath,
	}
	tracer := tracing.InitializeTracerForTest()

	hcp := httpclient.NewProvider()
	am := azuremonitor.ProvideService(hcp)
	cw := cloudwatch.ProvideService()
	cm := cloudmonitoring.ProvideService(hcp)
	es := elasticsearch.ProvideService(hcp)
	grap := graphite.ProvideService(hcp, tracer)
	idb := influxdb.ProvideService(hcp, features)
	lk := loki.ProvideService(hcp, tracer)
	otsdb := opentsdb.ProvideService(hcp)
	pr := prometheus.ProvideService(hcp)
	tmpo := tempo.ProvideService(hcp)
	td := testdatasource.ProvideService()
	pg := postgres.ProvideService(cfg, features)
	my := mysql.ProvideService()
	ms := mssql.ProvideService(cfg)
	db := db.InitTestDB(t, sqlstore.InitTestDBOpt{Cfg: cfg})
	sv2 := searchV2.ProvideService(cfg, db, nil, nil, tracer, features, nil, nil, nil)
	graf := grafanads.ProvideService(sv2, nil, features)
	pyroscope := pyroscope.ProvideService(hcp)
	parca := parca.ProvideService(hcp)
	zipkin := zipkin.ProvideService(hcp)
	jaeger := jaeger.ProvideService(hcp)
	coreRegistry := coreplugin.ProvideCoreRegistry(tracing.InitializeTracerForTest(), am, cw, cm, es, grap, idb, lk, otsdb, pr, tmpo, td, pg, my, ms, graf, pyroscope, parca, zipkin, jaeger)

	testCtx := pluginsintegration.CreateIntegrationTestCtx(t, cfg, coreRegistry)

	ctx := context.Background()
	verifyCorePluginCatalogue(t, ctx, testCtx.PluginStore)
	verifyPluginStaticRoutes(t, ctx, testCtx.PluginStore, testCtx.PluginStore)
	verifyBackendProcesses(t, testCtx.PluginRegistry.Plugins(ctx))
	verifyPluginQuery(t, ctx, testCtx.PluginClient)
}

func verifyPluginQuery(t *testing.T, ctx context.Context, c plugins.Client) {
	now := time.Unix(1661420870, 0)
	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			PluginID: "grafana-testdata-datasource",
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
	require.JSONEq(t, `{"results":{"A":{"frames":[{"schema":{"refId":"A","fields":[{"name":"time","type":"time","typeInfo":{"frame":"time.Time"}},{"name":"A-series","type":"number","typeInfo":{"frame":"int64","nullable":true}}]},"data":{"values":[[1661420570000,1661420630000,1661420690000,1661420750000,1661420810000,1661420870000],[1,20,90,30,5,0]]}}],"status":200}}}`, string(payload))
}

func verifyCorePluginCatalogue(t *testing.T, ctx context.Context, ps *pluginstore.Service) {
	t.Helper()

	expPanels := map[string]struct{}{
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
		"heatmap":        {},
		"histogram":      {},
		"live":           {},
		"logs":           {},
		"candlestick":    {},
		"news":           {},
		"nodeGraph":      {},
		"flamegraph":     {},
		"traces":         {},
		"piechart":       {},
		"stat":           {},
		"state-timeline": {},
		"status-history": {},
		"table":          {},
		"text":           {},
		"timeseries":     {},
		"trend":          {},
		"welcome":        {},
		"xychart":        {},
		"datagrid":       {},
	}

	expDataSources := map[string]struct{}{
		"cloudwatch":                       {},
		"grafana-azure-monitor-datasource": {},
		"stackdriver":                      {},
		"elasticsearch":                    {},
		"graphite":                         {},
		"influxdb":                         {},
		"loki":                             {},
		"opentsdb":                         {},
		"prometheus":                       {},
		"tempo":                            {},
		"grafana-testdata-datasource":      {},
		"grafana-postgresql-datasource":    {},
		"mysql":                            {},
		"mssql":                            {},
		"grafana":                          {},
		"alertmanager":                     {},
		"dashboard":                        {},
		"jaeger":                           {},
		"mixed":                            {},
		"zipkin":                           {},
		"grafana-pyroscope-datasource":     {},
		"parca":                            {},
	}

	expApps := map[string]struct{}{
		"test-app": {},
	}

	panels := ps.Plugins(ctx, plugins.TypePanel)
	require.Equal(t, len(expPanels), len(panels))
	for _, p := range panels {
		p, exists := ps.Plugin(ctx, p.ID)
		require.NotEqual(t, pluginstore.Plugin{}, p)
		require.True(t, exists)
		require.Contains(t, expPanels, p.ID)
	}

	dataSources := ps.Plugins(ctx, plugins.TypeDataSource)
	require.Equal(t, len(expDataSources), len(dataSources))
	for _, ds := range dataSources {
		p, exists := ps.Plugin(ctx, ds.ID)
		require.NotEqual(t, pluginstore.Plugin{}, p)
		require.True(t, exists)
		require.Contains(t, expDataSources, ds.ID)
	}

	apps := ps.Plugins(ctx, plugins.TypeApp)
	require.Equal(t, len(expApps), len(apps))
	for _, app := range apps {
		p, exists := ps.Plugin(ctx, app.ID)
		require.True(t, exists)
		require.NotNil(t, p)
		require.Contains(t, expApps, app.ID)
	}

	require.Equal(t, len(expPanels)+len(expDataSources)+len(expApps), len(ps.Plugins(ctx)))
}

func verifyPluginStaticRoutes(t *testing.T, ctx context.Context, rr plugins.StaticRouteResolver, ps *pluginstore.Service) {
	routes := make(map[string]*plugins.StaticRoute)
	for _, route := range rr.Routes(ctx) {
		routes[route.PluginID] = route
	}

	require.Len(t, routes, 1)

	testAppPlugin, _ := ps.Plugin(ctx, "test-app")
	require.Contains(t, routes, "test-app")
	require.Equal(t, routes["test-app"].Directory, testAppPlugin.Base())
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
