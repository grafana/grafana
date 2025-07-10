package coreplugin

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdklog "github.com/grafana/grafana-plugin-sdk-go/backend/log"
	sdktracing "github.com/grafana/grafana-plugin-sdk-go/backend/tracing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
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
)

const (
	CloudWatch      = "cloudwatch"
	CloudMonitoring = "stackdriver"
	AzureMonitor    = "grafana-azure-monitor-datasource"
	Elasticsearch   = "elasticsearch"
	Graphite        = "graphite"
	InfluxDB        = "influxdb"
	Loki            = "loki"
	OpenTSDB        = "opentsdb"
	Prometheus      = "prometheus"
	Tempo           = "tempo"
	TestData        = "grafana-testdata-datasource"
	TestDataAlias   = "testdata"
	PostgreSQL      = "grafana-postgresql-datasource"
	MySQL           = "mysql"
	MSSQL           = "mssql"
	Grafana         = "grafana"
	Pyroscope       = "grafana-pyroscope-datasource"
	Parca           = "parca"
	Zipkin          = "zipkin"
	Jaeger          = "jaeger"
)

func init() {
	// Non-optimal global solution to replace plugin SDK default loggers for core plugins.
	sdklog.DefaultLogger = &logWrapper{logger: log.New("plugin.coreplugin")}
	backend.Logger = sdklog.DefaultLogger
	backend.NewLoggerWith = func(args ...any) sdklog.Logger {
		for i, arg := range args {
			// Obtain logger name from args.
			if s, ok := arg.(string); ok && s == "logger" {
				l := &logWrapper{logger: log.New(args[i+1].(string))}
				// new args slice without logger name and logger name value
				if len(args) > 2 {
					newArgs := make([]any, 0, len(args)-2)
					newArgs = append(newArgs, args[:i]...)
					newArgs = append(newArgs, args[i+2:]...)
					return l.With(newArgs...)
				}
				return l
			}
		}
		return sdklog.DefaultLogger
	}
}

type Registry struct {
	store map[string]backendplugin.PluginFactoryFunc
}

func NewRegistry(store map[string]backendplugin.PluginFactoryFunc) *Registry {
	return &Registry{
		store: store,
	}
}

func ProvideCoreRegistry(tracer tracing.Tracer, am *azuremonitor.Service, cw *cloudwatch.Service, cm *cloudmonitoring.Service,
	es *elasticsearch.Service, grap *graphite.Service, idb *influxdb.Service, lk *loki.Service, otsdb *opentsdb.Service,
	pr *prometheus.Service, t *tempo.Service, td *testdatasource.Service, pg *postgres.Service, my *mysql.Service,
	ms *mssql.Service, graf *grafanads.Service, pyroscope *pyroscope.Service, parca *parca.Service, zipkin *zipkin.Service, jaeger *jaeger.Service) *Registry {
	// Non-optimal global solution to replace plugin SDK default tracer for core plugins.
	sdktracing.InitDefaultTracer(tracer)

	return NewRegistry(map[string]backendplugin.PluginFactoryFunc{
		CloudWatch:      asBackendPlugin(cw),
		CloudMonitoring: asBackendPlugin(cm),
		AzureMonitor:    asBackendPlugin(am),
		Elasticsearch:   asBackendPlugin(es),
		Graphite:        asBackendPlugin(grap),
		InfluxDB:        asBackendPlugin(idb),
		Loki:            asBackendPlugin(lk),
		OpenTSDB:        asBackendPlugin(otsdb),
		Prometheus:      asBackendPlugin(pr),
		Tempo:           asBackendPlugin(t),
		TestData:        asBackendPlugin(td),
		PostgreSQL:      asBackendPlugin(pg),
		MySQL:           asBackendPlugin(my),
		MSSQL:           asBackendPlugin(ms),
		Grafana:         asBackendPlugin(graf),
		Pyroscope:       asBackendPlugin(pyroscope),
		Parca:           asBackendPlugin(parca),
		Zipkin:          asBackendPlugin(zipkin),
		Jaeger:          asBackendPlugin(jaeger),
	})
}

func (cr *Registry) Get(pluginID string) backendplugin.PluginFactoryFunc {
	return cr.store[pluginID]
}

func (cr *Registry) BackendFactoryProvider() func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
	return func(_ context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
		if !p.IsCorePlugin() {
			return nil
		}

		return cr.Get(p.ID)
	}
}

func asBackendPlugin(svc any) backendplugin.PluginFactoryFunc {
	opts := backend.ServeOpts{}
	if queryHandler, ok := svc.(backend.QueryDataHandler); ok {
		opts.QueryDataHandler = queryHandler
	}
	if resourceHandler, ok := svc.(backend.CallResourceHandler); ok {
		opts.CallResourceHandler = resourceHandler
	}
	if streamHandler, ok := svc.(backend.StreamHandler); ok {
		opts.StreamHandler = streamHandler
	}
	if healthHandler, ok := svc.(backend.CheckHealthHandler); ok {
		opts.CheckHealthHandler = healthHandler
	}
	if storageHandler, ok := svc.(backend.AdmissionHandler); ok {
		opts.AdmissionHandler = storageHandler
	}

	if opts.QueryDataHandler != nil || opts.CallResourceHandler != nil ||
		opts.CheckHealthHandler != nil || opts.StreamHandler != nil {
		return New(opts)
	}

	return nil
}

type logWrapper struct {
	logger log.Logger
}

func (l *logWrapper) Debug(msg string, args ...any) {
	l.logger.Debug(msg, args...)
}

func (l *logWrapper) Info(msg string, args ...any) {
	l.logger.Info(msg, args...)
}

func (l *logWrapper) Warn(msg string, args ...any) {
	l.logger.Warn(msg, args...)
}

func (l *logWrapper) Error(msg string, args ...any) {
	l.logger.Error(msg, args...)
}

func (l *logWrapper) Level() sdklog.Level {
	return sdklog.NoLevel
}

func (l *logWrapper) With(args ...any) sdklog.Logger {
	return &logWrapper{
		logger: l.logger.New(args...),
	}
}

func (l *logWrapper) FromContext(ctx context.Context) sdklog.Logger {
	return &logWrapper{
		logger: l.logger.FromContext(ctx),
	}
}

var ErrCorePluginNotFound = errors.New("core plugin not found")

// NewPlugin factory for creating and initializing a single core plugin.
// Note: cfg only needed for mssql connection pooling defaults.
func NewPlugin(pluginID string, cfg *setting.Cfg, httpClientProvider *httpclient.Provider, tracer tracing.Tracer, features featuremgmt.FeatureToggles) (*plugins.Plugin, error) {
	jsonData := plugins.JSONData{
		ID:       pluginID,
		AliasIDs: []string{},
	}
	var svc any

	switch pluginID {
	case TestData, TestDataAlias:
		jsonData.ID = TestData
		jsonData.AliasIDs = append(jsonData.AliasIDs, TestDataAlias)
		svc = testdatasource.ProvideService()
	case CloudWatch:
		svc = cloudwatch.ProvideService()
	case CloudMonitoring:
		svc = cloudmonitoring.ProvideService(httpClientProvider)
	case AzureMonitor:
		svc = azuremonitor.ProvideService(httpClientProvider)
	case Elasticsearch:
		svc = elasticsearch.ProvideService(httpClientProvider)
	case Graphite:
		svc = graphite.ProvideService(httpClientProvider, tracer)
	case InfluxDB:
		svc = influxdb.ProvideService(httpClientProvider, features)
	case Loki:
		svc = loki.ProvideService(httpClientProvider, tracer)
	case OpenTSDB:
		svc = opentsdb.ProvideService(httpClientProvider)
	case Prometheus:
		svc = prometheus.ProvideService(httpClientProvider)
	case Tempo:
		svc = tempo.ProvideService(httpClientProvider)
	case PostgreSQL:
		svc = postgres.ProvideService(cfg)
	case MySQL:
		svc = mysql.ProvideService()
	case MSSQL:
		svc = mssql.ProvideService(cfg)
	case Pyroscope:
		svc = pyroscope.ProvideService(httpClientProvider)
	case Parca:
		svc = parca.ProvideService(httpClientProvider)
	case Zipkin:
		svc = zipkin.ProvideService(httpClientProvider)
	case Jaeger:
		svc = jaeger.ProvideService(httpClientProvider)
	default:
		return nil, ErrCorePluginNotFound
	}

	p := plugins.Plugin{
		JSONData: jsonData,
		Class:    plugins.ClassCore,
	}

	p.SetLogger(log.New(fmt.Sprintf("plugin.%s", p.ID)))

	backendFactory := asBackendPlugin(svc)
	if backendFactory == nil {
		return nil, ErrCorePluginNotFound
	}
	bp, err := backendFactory(p.ID, p.Logger(), tracer, nil)
	if err != nil {
		return nil, err
	}
	p.RegisterClient(bp)

	return &p, nil
}
