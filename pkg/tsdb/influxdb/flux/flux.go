package flux

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	influxdb2 "github.com/influxdata/influxdb-client-go"
	"github.com/influxdata/influxdb-client-go/api"
)

var (
	glog log.Logger
)

func init() {
	glog = log.New("tsdb.influx_flux")
}

// Query builds flux queries, executes them, and returns the results.
func Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	tRes := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	runner, err := RunnerFromDataSource(dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range tsdbQuery.Queries {

		qm, err := GetQueryModelTSDB(query, tsdbQuery.TimeRange, dsInfo)
		if err != nil {
			tRes.Results[query.RefId] = &tsdb.QueryResult{Error: err}
			continue
		}

		res := ExecuteQuery(context.Background(), *qm, runner, 10)

		tRes.Results[query.RefId] = backendDataResponseToTSDBResponse(&res, query.RefId)
	}
	return tRes, nil
}

// Runner is an influxdb2 Client with an attached org property and is used
// for running flux queries.
type Runner struct {
	client influxdb2.Client
	org    string
}

// This is an interface to help testing
type queryRunner interface {
	runQuery(ctx context.Context, q string) (*api.QueryTableResult, error)
}

// runQuery executes fluxQuery against the Runner's organization and returns an flux typed result.
func (r *Runner) runQuery(ctx context.Context, fluxQuery string) (*api.QueryTableResult, error) {
	return r.client.QueryApi(r.org).Query(ctx, fluxQuery)
}

// RunnerFromDataSource creates a runner from the datasource model (the datasource instance's configuration).
func RunnerFromDataSource(dsInfo *models.DataSource) (*Runner, error) {
	org := dsInfo.JsonData.Get("organization").MustString("")
	if org == "" {
		return nil, fmt.Errorf("missing organization in datasource configuration")
	}

	url := dsInfo.Url
	if url == "" {
		return nil, fmt.Errorf("missing url from datasource configuration")
	}
	token, found := dsInfo.SecureJsonData.DecryptedValue("token")
	if !found {
		return nil, fmt.Errorf("token is missing from datasource configuration and is needed to use Flux")
	}

	return &Runner{
		client: influxdb2.NewClient(url, token),
		org:    org,
	}, nil

}

// backendDataResponseToTSDBResponse takes the SDK's style response and changes it into a
// tsdb.QueryResult. This is a wrapper so less of existing code needs to be changed. This should
// be able to be removed in the near future https://github.com/grafana/grafana/pull/25472.
func backendDataResponseToTSDBResponse(dr *backend.DataResponse, refID string) *tsdb.QueryResult {
	qr := &tsdb.QueryResult{RefId: refID}

	qr.Error = dr.Error

	if dr.Frames != nil {
		qr.Dataframes = tsdb.NewDecodedDataFrames(dr.Frames)
	}
	return qr
}
