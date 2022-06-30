package managertest

import (
	"context"
	"net/http"
	"path/filepath"
	"testing"

	"go.opentelemetry.io/otel/trace"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/manager"
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

type PluginManagerOpts struct {
	SQLStore        *sqlstore.SQLStore
	GrafanaRootPath string
}

func ProvidePluginManager(t *testing.T, opts PluginManagerOpts) (*manager.PluginManager, error) {
	t.Helper()

	features := featuremgmt.WithFeatures()
	cfg := &setting.Cfg{
		Raw:                    ini.Empty(),
		Env:                    setting.Prod,
		StaticRootPath:         filepath.Join(opts.GrafanaRootPath, "public"),
		BundledPluginsPath:     filepath.Join(opts.GrafanaRootPath, "plugins-bundled/internal"),
		IsFeatureToggleEnabled: features.IsEnabled,
		PluginSettings: map[string]map[string]string{
			"plugin.datasource-id": {
				"path": "testdata/test-app",
			},
		},
	}

	tracer := &fakeTracer{}
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
	sv2 := searchV2.ProvideService(cfg, opts.SQLStore, nil, nil)
	graf := grafanads.ProvideService(cfg, sv2, nil)
	coreRegistry := coreplugin.ProvideCoreRegistry(am, cw, cm, es, grap, idb, lk, otsdb, pr, tmpo, td, pg, my, ms, graf)

	license := &licensing.OSSLicensingService{Cfg: cfg}
	pmCfg := plugins.FromGrafanaCfg(cfg)
	pm, err := manager.ProvideService(cfg, registry.NewInMemory(), loader.New(pmCfg, license, signature.NewUnsignedAuthorizer(pmCfg),
		provider.ProvideService(coreRegistry)))

	return pm, err
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
