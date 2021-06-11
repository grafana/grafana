package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	timeSeries = "time_series"
	dsName     = "grafana-azure-monitor-datasource"
)

var (
	azlog           = log.New("tsdb.azuremonitor")
	legendKeyFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
)

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "AzureMonitorService",
		InitPriority: registry.Low,
		Instance: &Service{
			Services: map[string]datasourceService{},
			proxy:    &httpServiceProxy{},
		},
	})
}

type serviceProxy interface {
	Do(rw http.ResponseWriter, req *http.Request, cli *http.Client) http.ResponseWriter
}

type Service struct {
	PluginManager        plugins.Manager       `inject:""`
	Cfg                  *setting.Cfg          `inject:""`
	BackendPluginManager backendplugin.Manager `inject:""`
	Services             map[string]datasourceService
	im                   instancemgmt.InstanceManager

	proxy serviceProxy
}

type azureMonitorSettings struct {
	AppInsightsAppId             string `json:"appInsightsAppId"`
	AzureLogAnalyticsSameAs      bool   `json:"azureLogAnalyticsSameAs"`
	ClientId                     string `json:"clientId"`
	CloudName                    string `json:"cloudName"`
	LogAnalyticsClientId         string `json:"logAnalyticsClientId"`
	LogAnalyticsDefaultWorkspace string `json:"logAnalyticsDefaultWorkspace"`
	LogAnalyticsSubscriptionId   string `json:"logAnalyticsSubscriptionId"`
	LogAnalyticsTenantId         string `json:"logAnalyticsTenantId"`
	SubscriptionId               string `json:"subscriptionId"`
	TenantId                     string `json:"tenantId"`
	AzureAuthType                string `json:"azureAuthType,omitempty"`
}

type datasourceInfo struct {
	Settings    azureMonitorSettings
	Routes      map[string]azRoute
	HTTPCliOpts httpclient.Options

	JSONData                map[string]interface{}
	DecryptedSecureJSONData map[string]string
	DatasourceID            int64
	OrgID                   int64
}

type datasourceService struct {
	URL        string
	HTTPClient *http.Client
}

func NewInstanceSettings() datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := map[string]interface{}{}
		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		azMonitorSettings := azureMonitorSettings{}
		err = json.Unmarshal(settings.JSONData, &azMonitorSettings)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		httpCliOpts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, fmt.Errorf("error getting http options: %w", err)
		}

		model := datasourceInfo{
			Settings:                azMonitorSettings,
			JSONData:                jsonData,
			DecryptedSecureJSONData: settings.DecryptedSecureJSONData,
			DatasourceID:            settings.ID,
			Routes:                  routes[azMonitorSettings.CloudName],
			HTTPCliOpts:             httpCliOpts,
		}
		return model, nil
	}
}

type azDatasourceExecutor interface {
	executeTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo datasourceInfo, client *http.Client, url string) (*backend.QueryDataResponse, error)
}

func (s *Service) getDataSourceFromPluginReq(req *backend.QueryDataRequest) (datasourceInfo, error) {
	i, err := s.im.Get(req.PluginContext)
	if err != nil {
		return datasourceInfo{}, err
	}
	dsInfo := i.(datasourceInfo)
	dsInfo.OrgID = req.PluginContext.OrgID
	return dsInfo, nil
}

func (s *Service) getDatasourceService(ctx context.Context, dsInfo datasourceInfo, routeName string) (datasourceService, error) {
	srv, ok := s.Services[routeName]
	if ok && srv.HTTPClient != nil {
		// If the service already exists, return it
		return s.Services[routeName], nil
	}

	route := dsInfo.Routes[routeName]
	client, err := newHTTPClient(ctx, route, dsInfo, s.Cfg)
	if err != nil {
		return datasourceService{}, err
	}
	s.Services[routeName] = datasourceService{
		URL:        dsInfo.Routes[routeName].URL,
		HTTPClient: client,
	}

	return s.Services[routeName], nil
}

func (s *Service) getDSAssetsFromPluginReq(ctx context.Context, req *backend.QueryDataRequest, dsName string) (datasourceInfo, datasourceService, error) {
	dsInfo, err := s.getDataSourceFromPluginReq(req)
	if err != nil {
		return datasourceInfo{}, datasourceService{}, err
	}
	service, err := s.getDatasourceService(ctx, dsInfo, dsName)
	if err != nil {
		return datasourceInfo{}, datasourceService{}, err
	}
	return dsInfo, service, nil
}

func (s *Service) newMux(executors map[string]azDatasourceExecutor) *datasource.QueryTypeMux {
	mux := datasource.NewQueryTypeMux()
	for dsType := range executors {
		// Make a copy of the string to keep the reference after the iterator
		dst := dsType
		mux.HandleFunc(dsType, func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			executor := executors[dst]
			dsInfo, service, err := s.getDSAssetsFromPluginReq(ctx, req, dst)
			if err != nil {
				return nil, err
			}
			return executor.executeTimeSeriesQuery(ctx, req.Queries, dsInfo, service.HTTPClient, service.URL)
		})
	}
	return mux
}

func (s *Service) Init() error {
	s.im = datasource.NewInstanceManager(NewInstanceSettings())
	executors := map[string]azDatasourceExecutor{
		azureMonitor:       &AzureMonitorDatasource{},
		appInsights:        &ApplicationInsightsDatasource{},
		azureLogAnalytics:  &AzureLogAnalyticsDatasource{},
		insightsAnalytics:  &InsightsAnalyticsDatasource{},
		azureResourceGraph: &AzureResourceGraphDatasource{},
	}
	mux := s.newMux(executors)
	resourceMux := http.NewServeMux()
	s.registerRoutes(resourceMux)
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler:    mux,
		CallResourceHandler: httpadapter.New(resourceMux),
	})

	if err := s.BackendPluginManager.RegisterAndStart(context.Background(), dsName, factory); err != nil {
		azlog.Error("Failed to register plugin", "error", err)
	}
	return nil
}
