package azuremonitor

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

var (
	azlog log.Logger
)

// AzureMonitorExecutor executes queries for the Azure Monitor datasource - all four services
type AzureMonitorExecutor struct {
	httpClient *http.Client
	dsInfo     *models.DataSource
}

// NewAzureMonitorExecutor initializes a http client
func NewAzureMonitorExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &AzureMonitorExecutor{
		httpClient: httpClient,
		dsInfo:     dsInfo,
	}, nil
}

func init() {
	azlog = log.New("tsdb.azuremonitor")
	tsdb.RegisterTsdbQueryEndpoint("grafana-azure-monitor-datasource", NewAzureMonitorExecutor)
}

// Query takes in the frontend queries, parses them into the query format
// expected by chosen Azure Monitor service (Azure Monitor, App Insights etc.)
// executes the queries against the API and parses the response into
// the right format
func (e *AzureMonitorExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	var result *tsdb.Response
	var err error

	var azureMonitorQueries []*tsdb.Query

	for _, query := range tsdbQuery.Queries {
		queryType := query.Model.Get("queryType").MustString("")

		switch queryType {
		case "Azure Monitor":
			azureMonitorQueries = append(azureMonitorQueries, query)
		default:
			return nil, fmt.Errorf("Alerting not supported for %s", queryType)
		}
	}

	azDatasource := &AzureMonitorDatasource{
		httpClient: e.httpClient,
		dsInfo:     e.dsInfo,
	}

	result, err = azDatasource.executeTimeSeriesQuery(ctx, azureMonitorQueries, tsdbQuery.TimeRange)

	return result, err
}
