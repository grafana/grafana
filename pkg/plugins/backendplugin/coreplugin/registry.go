package coreplugin

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch"
	"github.com/grafana/grafana/pkg/tsdb/graphite"
	"github.com/grafana/grafana/pkg/tsdb/influxdb"
	"github.com/grafana/grafana/pkg/tsdb/loki"
	"github.com/grafana/grafana/pkg/tsdb/opentsdb"
	"github.com/grafana/grafana/pkg/tsdb/prometheus"
	"github.com/grafana/grafana/pkg/tsdb/tempo"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

type Registry struct {
	CloudWatchService    *cloudwatch.CloudWatchService
	LokiService          *loki.Service
	TempoService         *tempo.Service
	ElasticSearchService *elasticsearch.Service
	GraphiteService      *graphite.Service
	InfluxDBService      *influxdb.Service
	OpenTSDBService      *opentsdb.Service
	TestDataService      *testdatasource.Service

	registry map[string]backendplugin.PluginFactoryFunc
}

type BackendFactoryProvider interface {
	BackendFactory(pluginID string) (backendplugin.PluginFactoryFunc, error)
}

func ProvideService(cloudWatchService *cloudwatch.CloudWatchService, lokiService *loki.Service,
	tempoService *tempo.Service, elasticSearchService *elasticsearch.Service, graphiteService *graphite.Service,
	influxDBService *influxdb.Service, openTSDBService *opentsdb.Service, prometheusService *prometheus.Service,
	azureMonitorService *azuremonitor.Service, testDataService *testdatasource.Service) BackendFactoryProvider {

	return newRegistry(cloudWatchService, lokiService, tempoService, elasticSearchService, graphiteService,
		influxDBService, openTSDBService, prometheusService, azureMonitorService, testDataService)
}

func newRegistry(cloudWatchService *cloudwatch.CloudWatchService, lokiService *loki.Service, tempoService *tempo.Service,
	elasticSearchService *elasticsearch.Service, graphiteService *graphite.Service, influxDBService *influxdb.Service,
	openTSDBService *opentsdb.Service, prometheusService *prometheus.Service, azureMonitorService *azuremonitor.Service,
	testDataService *testdatasource.Service) BackendFactoryProvider {

	// Azure Monitor
	amMux := azureMonitorService.NewMux()
	amResourceMux := http.NewServeMux()
	azureMonitorService.RegisterRoutes(amResourceMux)

	// Test Data
	tdMux := testDataService.NewMux()
	tdResourceMux := http.NewServeMux()
	testDataService.RegisterRoutes(tdResourceMux)

	return &Registry{
		CloudWatchService: cloudWatchService,
		registry: map[string]backendplugin.PluginFactoryFunc{
			"cloudwatch": New(backend.ServeOpts{
				QueryDataHandler: cloudWatchService.Executor,
			}),
			"loki": New(backend.ServeOpts{
				QueryDataHandler: lokiService,
			}),
			"tempo": New(backend.ServeOpts{
				QueryDataHandler: tempoService,
			}),
			"elasticsearch": New(backend.ServeOpts{
				QueryDataHandler: elasticSearchService,
			}),
			"graphite": New(backend.ServeOpts{
				QueryDataHandler: graphiteService,
			}),
			"influxdb": New(backend.ServeOpts{
				QueryDataHandler: influxDBService,
			}),
			"opentsdb": New(backend.ServeOpts{
				QueryDataHandler: openTSDBService,
			}),
			"prometheus": New(backend.ServeOpts{
				QueryDataHandler: prometheusService,
			}),
			"grafana-azure-monitor-datasource": New(backend.ServeOpts{
				QueryDataHandler:    amMux,
				CallResourceHandler: httpadapter.New(amResourceMux),
			}),
			"testdata": New(backend.ServeOpts{
				QueryDataHandler:    tdMux,
				CallResourceHandler: httpadapter.New(tdResourceMux),
				StreamHandler:       testDataService,
			}),
		},
	}
}

func (r *Registry) BackendFactory(pluginID string) (backendplugin.PluginFactoryFunc, error) {
	factory, ok := r.registry[pluginID]
	if !ok {
		return nil, FactoryNotFound{pluginID}
	}
	return factory, nil
}

type FactoryNotFound struct {
	PluginID string
}

func (e FactoryNotFound) Error() string {
	return fmt.Sprintf("no backend factory found for core plugin %s", e.PluginID)
}
