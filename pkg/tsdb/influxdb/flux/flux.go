package flux

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	influxdb2 "github.com/influxdata/influxdb-client-go"
)

var (
	glog log.Logger
)

func init() {
	glog = log.New("tsdb.influx_flux")
}

func Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	tRes := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	runner, err := RunnerFromDataSource(dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range tsdbQuery.Queries {

		qm, err := GetQueryModelTSDB(query, tsdbQuery.TimeRange)
		if err != nil {
			tRes.Results[query.RefId] = &tsdb.QueryResult{Error: err}
			continue
		}

		res := ExecuteQuery(context.Background(), *qm, *runner, 10)

		tRes.Results[query.RefId] = backendDataResponseToTSDBResponse(&res, query.RefId)
	}
	return tRes, nil
}

type Runner struct {
	client influxdb2.Client
	org    string
}

func (r *Runner) runQuery(ctx context.Context, q string) (*influxdb2.QueryTableResult, error) {
	return r.client.QueryApi(r.org).Query(ctx, q)
}

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

func backendDataResponseToTSDBResponse(dr *backend.DataResponse, refID string) *tsdb.QueryResult {
	qr := &tsdb.QueryResult{RefId: refID}

	if dr.Error != nil {
		qr.Error = dr.Error
		return qr
	}

	if dr.Frames != nil {
		qr.Dataframes, qr.Error = dr.Frames.MarshalArrow()
	}
	return qr
}
