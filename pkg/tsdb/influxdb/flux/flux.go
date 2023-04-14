package flux

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

var (
	glog = log.New("tsdb.influx_flux")
)

// Query builds flux queries, executes them, and returns the results.
func Query(ctx context.Context, dsInfo *models.DatasourceInfo, tsdbQuery backend.QueryDataRequest) (
	*backend.QueryDataResponse, error) {
	logger := glog.FromContext(ctx)
	tRes := backend.NewQueryDataResponse()
	logger.Debug("Received a query", "query", tsdbQuery)
	r, err := runnerFromDataSource(dsInfo)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}
	defer r.client.Close()

	timeRange := tsdbQuery.Queries[0].TimeRange
	for _, query := range tsdbQuery.Queries {
		qm, err := getQueryModel(query, timeRange, dsInfo)
		if err != nil {
			tRes.Responses[query.RefID] = backend.DataResponse{Error: err}
			continue
		}

		// If the default changes also update labels/placeholder in config page.
		maxSeries := dsInfo.MaxSeries
		res := executeQuery(ctx, logger, *qm, r, maxSeries)

		tRes.Responses[query.RefID] = res
	}
	return tRes, nil
}

// runner is an influxdb2 Client with an attached org property and is used
// for running flux queries.
type runner struct {
	client influxdb2.Client
	org    string
}

// This is an interface to help testing
type queryRunner interface {
	runQuery(ctx context.Context, q string) (*api.QueryTableResult, error)
}

// runQuery executes fluxQuery against the Runner's organization and returns a Flux typed result.
func (r *runner) runQuery(ctx context.Context, fluxQuery string) (*api.QueryTableResult, error) {
	qa := r.client.QueryAPI(r.org)
	return qa.Query(ctx, fluxQuery)
}

// runnerFromDataSource creates a runner from the datasource model (the datasource instance's configuration).
func runnerFromDataSource(dsInfo *models.DatasourceInfo) (*runner, error) {
	org := dsInfo.Organization
	if org == "" {
		return nil, fmt.Errorf("missing organization in datasource configuration")
	}

	url := dsInfo.URL
	if url == "" {
		return nil, fmt.Errorf("missing URL from datasource configuration")
	}
	opts := influxdb2.DefaultOptions()
	opts.HTTPOptions().SetHTTPClient(dsInfo.HTTPClient)
	return &runner{
		client: influxdb2.NewClientWithOptions(url, dsInfo.Token, opts),
		org:    org,
	}, nil
}
