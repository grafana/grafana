package flux

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
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
func Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	glog.Debug("Received a query", "query", *tsdbQuery)
	tRes := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	r, err := runnerFromDataSource(dsInfo)
	if err != nil {
		return nil, err
	}
	defer r.client.Close()

	for _, query := range tsdbQuery.Queries {
		qm, err := getQueryModelTSDB(query, tsdbQuery.TimeRange, dsInfo)
		if err != nil {
			tRes.Results[query.RefId] = &tsdb.QueryResult{Error: err}
			continue
		}

		res := executeQuery(ctx, *qm, r, 50)

		tRes.Results[query.RefId] = backendDataResponseToTSDBResponse(&res, query.RefId)
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
func runnerFromDataSource(dsInfo *models.DataSource) (*runner, error) {
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
	hc, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}
	opts.HTTPOptions().SetHTTPClient(hc)
	return &runner{
		client: influxdb2.NewClientWithOptions(url, token, opts),
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
