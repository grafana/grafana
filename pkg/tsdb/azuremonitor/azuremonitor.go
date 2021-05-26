package azuremonitor

import (
	"context"
	"fmt"
	"net/http"
	"regexp"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

const timeSeries = "time_series"

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
	PluginManager plugins.Manager `inject:""`
	Cfg           *setting.Cfg    `inject:""`
}

func (s *Service) Init() error {
	return nil
}

// AzureMonitorExecutor executes queries for the Azure Monitor datasource - all four services
type AzureMonitorExecutor struct {
	httpClient    *http.Client
	dsInfo        *models.DataSource
	pluginManager plugins.Manager
	cfg           *setting.Cfg
}

// NewAzureMonitorExecutor initializes a http client
//nolint: staticcheck // plugins.DataPlugin deprecated
func (s *Service) NewExecutor(dsInfo *models.DataSource) (plugins.DataPlugin, error) {
	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &AzureMonitorExecutor{
		httpClient:    httpClient,
		dsInfo:        dsInfo,
		pluginManager: s.PluginManager,
		cfg:           s.Cfg,
	}, nil
}

// Query takes in the frontend queries, parses them into the query format
// expected by chosen Azure Monitor service (Azure Monitor, App Insights etc.)
// executes the queries against the API and parses the response into
// the right format
//nolint: staticcheck // plugins.DataPlugin deprecated
func (e *AzureMonitorExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource,
	tsdbQuery plugins.DataQuery) (plugins.DataResponse, error) {
	var err error

	var azureMonitorQueries []backend.DataQuery
	var applicationInsightsQueries []backend.DataQuery
	var azureLogAnalyticsQueries []backend.DataQuery
	var insightsAnalyticsQueries []backend.DataQuery
	var azureResourceGraphQueries []backend.DataQuery

	for _, query := range tsdbQuery.Queries {
		queryType := query.Model.Get("queryType").MustString("")

		// FIXME: query param
		switch queryType {
		case "Azure Monitor":
			azureMonitorQueries = append(azureMonitorQueries, backend.DataQuery{})
		case "Application Insights":
			applicationInsightsQueries = append(applicationInsightsQueries, backend.DataQuery{})
		case "Azure Log Analytics":
			azureLogAnalyticsQueries = append(azureLogAnalyticsQueries, backend.DataQuery{})
		case "Insights Analytics":
			insightsAnalyticsQueries = append(insightsAnalyticsQueries, backend.DataQuery{})
		case "Azure Resource Graph":
			azureResourceGraphQueries = append(azureResourceGraphQueries, backend.DataQuery{})
		default:
			return plugins.DataResponse{}, fmt.Errorf("alerting not supported for %q", queryType)
		}
	}

	azDatasource := &AzureMonitorDatasource{
		httpClient:    e.httpClient,
		dsInfo:        e.dsInfo,
		pluginManager: e.pluginManager,
		cfg:           e.cfg,
	}

	aiDatasource := &ApplicationInsightsDatasource{
		httpClient:    e.httpClient,
		dsInfo:        e.dsInfo,
		pluginManager: e.pluginManager,
		cfg:           e.cfg,
	}

	alaDatasource := &AzureLogAnalyticsDatasource{
		httpClient:    e.httpClient,
		dsInfo:        e.dsInfo,
		pluginManager: e.pluginManager,
		cfg:           e.cfg,
	}

	iaDatasource := &InsightsAnalyticsDatasource{
		httpClient:    e.httpClient,
		dsInfo:        e.dsInfo,
		pluginManager: e.pluginManager,
		cfg:           e.cfg,
	}

	argDatasource := &AzureResourceGraphDatasource{
		httpClient:    e.httpClient,
		dsInfo:        e.dsInfo,
		pluginManager: e.pluginManager,
	}

	azResult, err := azDatasource.executeTimeSeriesQuery(ctx, azureMonitorQueries)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	aiResult, err := aiDatasource.executeTimeSeriesQuery(ctx, applicationInsightsQueries)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	alaResult, err := alaDatasource.executeTimeSeriesQuery(ctx, azureLogAnalyticsQueries)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	iaResult, err := iaDatasource.executeTimeSeriesQuery(ctx, insightsAnalyticsQueries)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	argResult, err := argDatasource.executeTimeSeriesQuery(ctx, azureResourceGraphQueries)
	if err != nil {
		return plugins.DataResponse{}, err
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

	// Fixme, change iface and contract
	return plugins.DataResponse{}, nil
}
