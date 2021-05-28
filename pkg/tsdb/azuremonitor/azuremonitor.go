package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkHTTPClient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
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
		Instance:     &Service{},
	})
}

type Service struct {
	PluginManager        plugins.Manager       `inject:""`
	HTTPClientProvider   httpclient.Provider   `inject:""`
	Cfg                  *setting.Cfg          `inject:""`
	BackendPluginManager backendplugin.Manager `inject:""`
}

type datasourceInfo struct {
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

	HTTPClient              *http.Client
	URL                     string
	JSONData                map[string]interface{}
	DecryptedSecureJSONData map[string]string
	DatasourceID            int64
}

func NewInstanceSettings() datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		opts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, err
		}

		client, err := sdkHTTPClient.New(opts)
		if err != nil {
			return nil, err
		}

		// TODO: Refactor model and jsonData
		// Likely, adapting plugin proxy
		model := datasourceInfo{}
		err = json.Unmarshal(settings.JSONData, &model)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		jsonData := map[string]interface{}{}
		err = json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		model.HTTPClient = client
		model.URL = settings.URL
		model.JSONData = jsonData
		model.DecryptedSecureJSONData = settings.DecryptedSecureJSONData
		model.DatasourceID = settings.ID

		return model, nil
	}
}

func newExecutor(im instancemgmt.InstanceManager, pm plugins.Manager, httpC httpclient.Provider, cfg *setting.Cfg) *AzureMonitorExecutor {
	return &AzureMonitorExecutor{
		im:                 im,
		httpClientProvider: httpC,
		cfg:                cfg,
		pluginManager:      pm,
	}
}

func (s *Service) Init() error {
	im := datasource.NewInstanceManager(NewInstanceSettings())
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: newExecutor(im, s.PluginManager, s.HTTPClientProvider, s.Cfg),
	})

	if err := s.BackendPluginManager.Register(dsName, factory); err != nil {
		azlog.Error("Failed to register plugin", "error", err)
	}
	return nil
}

// AzureMonitorExecutor executes queries for the Azure Monitor datasource - all four services
type AzureMonitorExecutor struct {
	im                 instancemgmt.InstanceManager
	pluginManager      plugins.Manager
	cfg                *setting.Cfg
	httpClientProvider httpclient.Provider
}

// Query takes in the frontend queries, parses them into the query format
// expected by chosen Azure Monitor service (Azure Monitor, App Insights etc.)
// executes the queries against the API and parses the response into
// the right format
func (e *AzureMonitorExecutor) QueryData(ctx context.Context,
	req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	var err error

	var azureMonitorQueries []backend.DataQuery
	var applicationInsightsQueries []backend.DataQuery
	var azureLogAnalyticsQueries []backend.DataQuery
	var insightsAnalyticsQueries []backend.DataQuery
	var azureResourceGraphQueries []backend.DataQuery

	i, err := e.im.Get(req.PluginContext)
	if err != nil {
		return nil, err
	}

	datasourceInfo := i.(datasourceInfo)
	for _, query := range req.Queries {
		model, err := simplejson.NewJson(query.JSON)
		if err != nil {
			return nil, err
		}

		queryType := model.Get("queryType").MustString("")

		switch queryType {
		case "Azure Monitor":
			azureMonitorQueries = append(azureMonitorQueries, query)
		case "Application Insights":
			applicationInsightsQueries = append(applicationInsightsQueries, query)
		case "Azure Log Analytics":
			azureLogAnalyticsQueries = append(azureLogAnalyticsQueries, query)
		case "Insights Analytics":
			insightsAnalyticsQueries = append(insightsAnalyticsQueries, query)
		case "Azure Resource Graph":
			azureResourceGraphQueries = append(azureResourceGraphQueries, query)
		default:
			return nil, fmt.Errorf("alerting not supported for %q", queryType)
		}
	}

	azDatasource := &AzureMonitorDatasource{
		dsInfo:        datasourceInfo,
		pluginManager: e.pluginManager,
		cfg:           e.cfg,
	}

	aiDatasource := &ApplicationInsightsDatasource{
		dsInfo:        datasourceInfo,
		pluginManager: e.pluginManager,
		cfg:           e.cfg,
	}

	alaDatasource := &AzureLogAnalyticsDatasource{
		dsInfo:        datasourceInfo,
		pluginManager: e.pluginManager,
		cfg:           e.cfg,
	}

	iaDatasource := &InsightsAnalyticsDatasource{
		dsInfo:        datasourceInfo,
		pluginManager: e.pluginManager,
		cfg:           e.cfg,
	}

	argDatasource := &AzureResourceGraphDatasource{
		dsInfo:        datasourceInfo,
		pluginManager: e.pluginManager,
	}

	azResult, err := azDatasource.executeTimeSeriesQuery(ctx, azureMonitorQueries)
	if err != nil {
		return azResult, err
	}

	aiResult, err := aiDatasource.executeTimeSeriesQuery(ctx, applicationInsightsQueries)
	if err != nil {
		return aiResult, err
	}

	alaResult, err := alaDatasource.executeTimeSeriesQuery(ctx, azureLogAnalyticsQueries)
	if err != nil {
		return alaResult, err
	}

	iaResult, err := iaDatasource.executeTimeSeriesQuery(ctx, insightsAnalyticsQueries)
	if err != nil {
		return iaResult, err
	}

	argResult, err := argDatasource.executeTimeSeriesQuery(ctx, azureResourceGraphQueries)
	if err != nil {
		return argResult, err
	}

	// TODO: Collapse into a loop?
	for k, v := range aiResult.Responses {
		azResult.Responses[k] = v
	}

	for k, v := range alaResult.Responses {
		azResult.Responses[k] = v
	}

	for k, v := range iaResult.Responses {
		azResult.Responses[k] = v
	}

	for k, v := range argResult.Responses {
		azResult.Responses[k] = v
	}

	return azResult, nil
}
