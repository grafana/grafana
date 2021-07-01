package tsdb

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor"
	"github.com/grafana/grafana/pkg/tsdb/cloudmonitoring"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch"
	"github.com/grafana/grafana/pkg/tsdb/graphite"
	"github.com/grafana/grafana/pkg/tsdb/influxdb"
	"github.com/grafana/grafana/pkg/tsdb/loki"
	"github.com/grafana/grafana/pkg/tsdb/mssql"
	"github.com/grafana/grafana/pkg/tsdb/mysql"
	"github.com/grafana/grafana/pkg/tsdb/postgres"
	"github.com/grafana/grafana/pkg/tsdb/prometheus"
	"github.com/grafana/grafana/pkg/tsdb/tempo"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
)

// NewService returns a new Service.
func NewService(cfg *setting.Cfg, _ *cloudwatch.CloudWatchService,
	cloudMonitoringService *cloudmonitoring.Service, _ *azuremonitor.Service,
	pluginManager plugins.Manager, postgresService *postgres.PostgresService,
	httpClientProvider httpclient.Provider, _ *testdatasource.TestDataPlugin,
	backendPluginManager backendplugin.Manager) *Service {
	s := newService(cfg, pluginManager, backendPluginManager)

	// register backend data sources using legacy plugin
	// contracts/non-SDK contracts
	s.registry["graphite"] = graphite.New(httpClientProvider)
	s.registry["opentsdb"] = opentsdb.New(httpClientProvider)
	s.registry["prometheus"] = prometheus.New(httpClientProvider)
	s.registry["influxdb"] = influxdb.New(httpClientProvider)
	s.registry["mssql"] = mssql.NewExecutor
	s.registry["postgres"] = postgresService.NewExecutor
	s.registry["mysql"] = mysql.New(httpClientProvider)
	s.registry["elasticsearch"] = elasticsearch.New(httpClientProvider)
	s.registry["stackdriver"] = cloudMonitoringService.NewExecutor
	s.registry["loki"] = loki.New(httpClientProvider)
	s.registry["tempo"] = tempo.New(httpClientProvider)

	return s
}

func newService(cfg *setting.Cfg, manager plugins.Manager, backendPluginManager backendplugin.Manager) *Service {
	return &Service{
		Cfg:                  cfg,
		PluginManager:        manager,
		BackendPluginManager: backendPluginManager,
		// nolint:staticcheck // plugins.DataPlugin deprecated
		registry: map[string]func(*models.DataSource) (plugins.DataPlugin, error){},
	}
}

// Service handles data requests to data sources.
type Service struct {
	Cfg                  *setting.Cfg
	PluginManager        plugins.Manager
	BackendPluginManager backendplugin.Manager

	//nolint: staticcheck // plugins.DataPlugin deprecated
	registry map[string]func(*models.DataSource) (plugins.DataPlugin, error)
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func (s *Service) HandleRequest(ctx context.Context, ds *models.DataSource, query plugins.DataQuery) (plugins.DataResponse, error) {
	if factory, exists := s.registry[ds.Type]; exists {
		var err error
		plugin, err := factory(ds)
		if err != nil {
			return plugins.DataResponse{}, fmt.Errorf("could not instantiate endpoint for data plugin %q: %w",
				ds.Type, err)
		}

		return plugin.DataQuery(ctx, ds, query)
	}

	return dataPluginQueryAdapter(ds.Type, s.BackendPluginManager).DataQuery(ctx, ds, query)
}

// RegisterQueryHandler registers a query handler factory.
// This is only exposed for tests!
//nolint: staticcheck // plugins.DataPlugin deprecated
func (s *Service) RegisterQueryHandler(name string, factory func(*models.DataSource) (plugins.DataPlugin, error)) {
	s.registry[name] = factory
}
