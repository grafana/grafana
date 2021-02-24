package azuremonitor

import (
	"context"
	"fmt"
	"net/http"
	"regexp"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	pluginmodels "github.com/grafana/grafana/pkg/plugins/models"
	"github.com/grafana/grafana/pkg/registry"
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
}

func (s *Service) Init() error {
	return nil
}

// AzureMonitorExecutor executes queries for the Azure Monitor datasource - all four services
type AzureMonitorExecutor struct {
	httpClient *http.Client
	dsInfo     *models.DataSource
}

// NewAzureMonitorExecutor initializes a http client
func (s *Service) NewExecutor(dsInfo *models.DataSource) (pluginmodels.DataPlugin, error) {
	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &AzureMonitorExecutor{
		httpClient: httpClient,
		dsInfo:     dsInfo,
	}, nil
}

// Query takes in the frontend queries, parses them into the query format
// expected by chosen Azure Monitor service (Azure Monitor, App Insights etc.)
// executes the queries against the API and parses the response into
// the right format
func (e *AzureMonitorExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource,
	tsdbQuery pluginmodels.DataQuery) (pluginmodels.DataResponse, error) {
	var err error

	var azureMonitorQueries []pluginmodels.DataSubQuery
	var applicationInsightsQueries []pluginmodels.DataSubQuery
	var azureLogAnalyticsQueries []pluginmodels.DataSubQuery
	var insightsAnalyticsQueries []pluginmodels.DataSubQuery

	for _, query := range tsdbQuery.Queries {
		queryType := query.Model.Get("queryType").MustString("")

		switch queryType {
		case "Azure Monitor":
			azureMonitorQueries = append(azureMonitorQueries, query)
		case "Application Insights":
			applicationInsightsQueries = append(applicationInsightsQueries, query)
		case "Azure Log Analytics":
			azureLogAnalyticsQueries = append(azureLogAnalyticsQueries, query)
		case "Insights Analytics":
			insightsAnalyticsQueries = append(insightsAnalyticsQueries, query)
		default:
			return pluginmodels.DataResponse{}, fmt.Errorf("alerting not supported for %q", queryType)
		}
	}

	azDatasource := &AzureMonitorDatasource{
		httpClient: e.httpClient,
		dsInfo:     e.dsInfo,
	}

	aiDatasource := &ApplicationInsightsDatasource{
		httpClient: e.httpClient,
		dsInfo:     e.dsInfo,
	}

	alaDatasource := &AzureLogAnalyticsDatasource{
		httpClient: e.httpClient,
		dsInfo:     e.dsInfo,
	}

	iaDatasource := &InsightsAnalyticsDatasource{
		httpClient: e.httpClient,
		dsInfo:     e.dsInfo,
	}

	azResult, err := azDatasource.executeTimeSeriesQuery(ctx, azureMonitorQueries, *tsdbQuery.TimeRange)
	if err != nil {
		return pluginmodels.DataResponse{}, err
	}

	aiResult, err := aiDatasource.executeTimeSeriesQuery(ctx, applicationInsightsQueries, *tsdbQuery.TimeRange)
	if err != nil {
		return pluginmodels.DataResponse{}, err
	}

	alaResult, err := alaDatasource.executeTimeSeriesQuery(ctx, azureLogAnalyticsQueries, *tsdbQuery.TimeRange)
	if err != nil {
		return pluginmodels.DataResponse{}, err
	}

	iaResult, err := iaDatasource.executeTimeSeriesQuery(ctx, insightsAnalyticsQueries, *tsdbQuery.TimeRange)
	if err != nil {
		return pluginmodels.DataResponse{}, err
	}

	for k, v := range aiResult.Results {
		azResult.Results[k] = v
	}

	for k, v := range alaResult.Results {
		azResult.Results[k] = v
	}

	for k, v := range iaResult.Results {
		azResult.Results[k] = v
	}

	return azResult, nil
}
