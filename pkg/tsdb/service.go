package tsdb

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
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
	"github.com/grafana/grafana/pkg/tsdb/opentsdb"
	"github.com/grafana/grafana/pkg/tsdb/postgres"
	"github.com/grafana/grafana/pkg/tsdb/prometheus"
	"github.com/grafana/grafana/pkg/tsdb/tempo"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
)

// NewService returns a new Service.
func NewService() Service {
	return Service{
		//nolint: staticcheck // plugins.DataPlugin deprecated
		registry:      map[string]func(*models.DataSource) (plugins.DataPlugin, error){},
		providerProxy: newProviderProxy(log.New("tsdb.provider-proxy")),
		logger:        log.New("tsdb"),
	}
}

func init() {
	svc := NewService()
	registry.Register(&registry.Descriptor{
		Name:     "DataService",
		Instance: &svc,
	})
}

// Service handles data requests to data sources.
type Service struct {
	Cfg                    *setting.Cfg              `inject:""`
	CloudWatchLogsService  *cloudwatch.LogsService   `inject:""`
	PostgresService        *postgres.PostgresService `inject:""`
	CloudMonitoringService *cloudmonitoring.Service  `inject:""`
	AzureMonitorService    *azuremonitor.Service     `inject:""`
	PluginManager          plugins.Manager           `inject:""`
	BackendPluginManager   backendplugin.Manager     `inject:""`
	HTTPClientProvider     httpclient.Provider       `inject:""`

	//nolint: staticcheck // plugins.DataPlugin deprecated
	registry      map[string]func(*models.DataSource) (plugins.DataPlugin, error)
	providerProxy *providerProxy
	logger        log.Logger
}

// Init initialises the service.
func (s *Service) Init() error {
	s.registry["graphite"] = graphite.New(s.HTTPClientProvider)
	s.registry["opentsdb"] = opentsdb.New(s.HTTPClientProvider)
	s.registry["prometheus"] = prometheus.New(s.HTTPClientProvider)
	s.registry["influxdb"] = influxdb.New(s.HTTPClientProvider)
	s.registry["mssql"] = mssql.NewExecutor
	s.registry["postgres"] = s.PostgresService.NewExecutor
	s.registry["mysql"] = mysql.New(s.HTTPClientProvider)
	s.registry["elasticsearch"] = elasticsearch.New(s.HTTPClientProvider)
	s.registry["stackdriver"] = s.CloudMonitoringService.NewExecutor
	s.registry["grafana-azure-monitor-datasource"] = s.AzureMonitorService.NewExecutor
	s.registry["loki"] = loki.New(s.HTTPClientProvider)
	s.registry["tempo"] = tempo.New(s.HTTPClientProvider)

	cloudWatchDataSource, err := cloudwatch.New(s.Cfg, s.CloudWatchLogsService)
	if err != nil {
		return err
	}
	s.providerProxy.register("cloudwatch-provider", cloudWatchDataSource)

	testDataSource, err := testdatasource.New(s.Cfg)
	if err != nil {
		return err
	}
	s.providerProxy.register("testdata-provider", testDataSource)

	factory := coreplugin.New(coreplugin.ServeOpts{
		Provider:            s.providerProxy,
		CheckHealthHandler:  s.providerProxy,
		CallResourceHandler: s.providerProxy,
		QueryDataHandler:    s.providerProxy,
		StreamHandler:       s.providerProxy,
	})

	return s.BackendPluginManager.RegisterAndStart(context.Background(), "grafana-core-provider-proxy", factory)
}

func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	stopErr := s.BackendPluginManager.UnregisterAndStop(ctx, "grafana-core-provider-proxy")
	if stopErr != nil {
		s.logger.Error("Failed to unregister and stop plugin", "error", stopErr)
	}
	return ctx.Err()
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
