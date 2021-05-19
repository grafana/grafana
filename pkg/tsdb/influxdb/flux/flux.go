package flux

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

var (
	glog log.Logger
)

func init() {
	glog = log.New("tsdb.influx_flux")
}

// Query builds flux queries, executes them, and returns the results.
//nolint: staticcheck // plugins.DataQuery deprecated
func Query(ctx context.Context, httpClientProvider httpclient.Provider, dsInfo *models.DataSource, tsdbQuery plugins.DataQuery) (
	plugins.DataResponse, error) {
	glog.Debug("Received a query", "query", tsdbQuery)
	tRes := plugins.DataResponse{
		Results: make(map[string]plugins.DataQueryResult),
	}
	r, err := runnerFromDataSource(httpClientProvider, dsInfo)
	if err != nil {
		return plugins.DataResponse{}, err
	}
	defer r.client.Close()

	for _, query := range tsdbQuery.Queries {
		qm, err := getQueryModelTSDB(query, *tsdbQuery.TimeRange, dsInfo)
		if err != nil {
			tRes.Results[query.RefID] = plugins.DataQueryResult{Error: err}
			continue
		}

		// If the default changes also update labels/placeholder in config page.
		maxSeries := dsInfo.JsonData.Get("maxSeries").MustInt(1000)
		res := executeQuery(ctx, *qm, r, maxSeries)

		tRes.Results[query.RefID] = backendDataResponseToDataResponse(&res, query.RefID)
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
func runnerFromDataSource(httpClientProvider httpclient.Provider, dsInfo *models.DataSource) (*runner, error) {
	org := dsInfo.JsonData.Get("organization").MustString("")
	if org == "" {
		return nil, fmt.Errorf("missing organization in datasource configuration")
	}

	url := dsInfo.Url
	if url == "" {
		return nil, fmt.Errorf("missing URL from datasource configuration")
	}
	token, found := dsInfo.SecureJsonData.DecryptedValue("token")
	if !found {
		return nil, fmt.Errorf("token is missing from datasource configuration and is needed to use Flux")
	}

	opts := influxdb2.DefaultOptions()
	hc, err := dsInfo.GetHTTPClient(httpClientProvider)
	if err != nil {
		return nil, err
	}
	opts.HTTPOptions().SetHTTPClient(hc)
	return &runner{
		client: influxdb2.NewClientWithOptions(url, token, opts),
		org:    org,
	}, nil
}

// backendDataResponseToDataResponse takes the SDK's style response and changes it into a
// plugins.DataQueryResult. This is a wrapper so less of existing code needs to be changed. This should
// be able to be removed in the near future https://github.com/grafana/grafana/pull/25472.
//nolint: staticcheck // plugins.DataQueryResult deprecated
func backendDataResponseToDataResponse(dr *backend.DataResponse, refID string) plugins.DataQueryResult {
	qr := plugins.DataQueryResult{
		RefID: refID,
		Error: dr.Error,
	}
	if dr.Frames != nil {
		qr.Dataframes = plugins.NewDecodedDataFrames(dr.Frames)
	}
	return qr
}
