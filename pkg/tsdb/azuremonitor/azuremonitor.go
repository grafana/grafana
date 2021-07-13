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
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
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
		Instance:     &Service{},
	})
}

type Service struct {
	PluginManager        plugins.Manager       `inject:""`
	Cfg                  *setting.Cfg          `inject:""`
	BackendPluginManager backendplugin.Manager `inject:""`
}

type azureMonitorSettings struct {
	SubscriptionId               string `json:"subscriptionId"`
	LogAnalyticsDefaultWorkspace string `json:"logAnalyticsDefaultWorkspace"`
	AppInsightsAppId             string `json:"appInsightsAppId"`
}

type datasourceInfo struct {
	Cloud       string
	Credentials azcredentials.AzureCredentials
	Settings    azureMonitorSettings
	Services    map[string]datasourceService
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

func NewInstanceSettings(cfg *setting.Cfg) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData, err := simplejson.NewJson(settings.JSONData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		jsonDataObj := map[string]interface{}{}
		err = json.Unmarshal(settings.JSONData, &jsonDataObj)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		azMonitorSettings := azureMonitorSettings{}
		err = json.Unmarshal(settings.JSONData, &azMonitorSettings)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		cloud, err := getAzureCloud(cfg, jsonData)
		if err != nil {
			return nil, fmt.Errorf("error getting credentials: %w", err)
		}

		credentials, err := getAzureCredentials(cfg, jsonData, settings.DecryptedSecureJSONData)
		if err != nil {
			return nil, fmt.Errorf("error getting credentials: %w", err)
		}

		httpCliOpts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, fmt.Errorf("error getting http options: %w", err)
		}

		model := datasourceInfo{
			Cloud:                   cloud,
			Credentials:             credentials,
			Settings:                azMonitorSettings,
			JSONData:                jsonDataObj,
			DecryptedSecureJSONData: settings.DecryptedSecureJSONData,
			DatasourceID:            settings.ID,
			Services:                map[string]datasourceService{},
			Routes:                  routes[cloud],
			HTTPCliOpts:             httpCliOpts,
		}

		return model, nil
	}
}

type azDatasourceExecutor interface {
	executeTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo datasourceInfo) (*backend.QueryDataResponse, error)
}

func newExecutor(im instancemgmt.InstanceManager, cfg *setting.Cfg, executors map[string]azDatasourceExecutor) *datasource.QueryTypeMux {
	mux := datasource.NewQueryTypeMux()
	for dsType := range executors {
		// Make a copy of the string to keep the reference after the iterator
		dst := dsType
		mux.HandleFunc(dsType, func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			i, err := im.Get(req.PluginContext)
			if err != nil {
				return nil, err
			}
			dsInfo := i.(datasourceInfo)
			dsInfo.OrgID = req.PluginContext.OrgID
			ds := executors[dst]
			if _, ok := dsInfo.Services[dst]; !ok {
				// Create an HTTP Client if it has not been created before
				route := dsInfo.Routes[dst]
				client, err := newHTTPClient(route, dsInfo, cfg)
				if err != nil {
					return nil, err
				}
				dsInfo.Services[dst] = datasourceService{
					URL:        dsInfo.Routes[dst].URL,
					HTTPClient: client,
				}
			}
			return ds.executeTimeSeriesQuery(ctx, req.Queries, dsInfo)
		})
	}
	return mux
}

func (s *Service) Init() error {
	im := datasource.NewInstanceManager(NewInstanceSettings(s.Cfg))
	executors := map[string]azDatasourceExecutor{
		azureMonitor:       &AzureMonitorDatasource{},
		appInsights:        &ApplicationInsightsDatasource{},
		azureLogAnalytics:  &AzureLogAnalyticsDatasource{},
		insightsAnalytics:  &InsightsAnalyticsDatasource{},
		azureResourceGraph: &AzureResourceGraphDatasource{},
	}
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: newExecutor(im, s.Cfg, executors),
	})

	if err := s.BackendPluginManager.Register(dsName, factory); err != nil {
		azlog.Error("Failed to register plugin", "error", err)
	}
	return nil
}
