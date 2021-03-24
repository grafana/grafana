package tsdb

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
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
)

// NewService returns a new Service.
func NewService(cfg *setting.Cfg, cloudWatchService *cloudwatch.CloudWatchService,
	cloudMonitoringService *cloudmonitoring.Service, azureMonitorService *azuremonitor.Service,
	pluginManager plugins.Manager, postgresService *postgres.PostgresService) *Service {
	return &Service{
		Cfg:                    cfg,
		CloudWatchService:      cloudWatchService,
		CloudMonitoringService: cloudMonitoringService,
		AzureMonitorService:    azureMonitorService,
		PluginManager:          pluginManager,
		registry: map[string]func(*models.DataSource) (plugins.DataPlugin, error){
			"graphite":                         graphite.NewExecutor,
			"opentsdb":                         opentsdb.NewExecutor,
			"prometheus":                       prometheus.NewExecutor,
			"influxdb":                         influxdb.NewExecutor,
			"mssql":                            mssql.NewExecutor,
			"postgres":                         postgresService.NewExecutor,
			"mysql":                            mysql.NewExecutor,
			"elasticsearch":                    elasticsearch.NewExecutor,
			"stackdriver":                      cloudMonitoringService.NewExecutor,
			"grafana-azure-monitor-datasource": azureMonitorService.NewExecutor,
			"loki":                             loki.NewExecutor,
			"tempo":                            tempo.NewExecutor,
		},
	}
}

// Service handles data requests to data sources.
type Service struct {
	Cfg                    *setting.Cfg
	CloudWatchService      *cloudwatch.CloudWatchService
	CloudMonitoringService *cloudmonitoring.Service
	AzureMonitorService    *azuremonitor.Service
	PluginManager          plugins.Manager

	registry map[string]func(*models.DataSource) (plugins.DataPlugin, error)
}

// Init initialises the service.
func (s *Service) Init() error {
	return nil
}

func (s *Service) HandleRequest(ctx context.Context, ds *models.DataSource, query plugins.DataQuery) (
	plugins.DataResponse, error) {
	plugin := s.PluginManager.GetDataPlugin(ds.Type)
	if plugin == nil {
		factory, exists := s.registry[ds.Type]
		if !exists {
			return plugins.DataResponse{}, fmt.Errorf(
				"could not find plugin corresponding to data source type: %q", ds.Type)
		}

		var err error
		plugin, err = factory(ds)
		if err != nil {
			return plugins.DataResponse{}, fmt.Errorf("could not instantiate endpoint for data plugin %q: %w",
				ds.Type, err)
		}
	}

	return plugin.DataQuery(ctx, ds, query)
}

// RegisterQueryHandler registers a query handler factory.
// This is only exposed for tests!
func (s *Service) RegisterQueryHandler(name string, factory func(*models.DataSource) (plugins.DataPlugin, error)) {
	s.registry[name] = factory
}
