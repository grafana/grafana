package flux

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
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
	_, _ = RunnerFromDataSource(dsInfo)
	frames := data.Frames{data.NewFrame("", data.NewField("test", nil, []string{"Hello"}))}
	encoded, err := frames.MarshalArrow()
	if err != nil {
		return nil, err
	}
	return &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{
			"A": {
				Dataframes: encoded,
			},
		},
	}, nil
}

type Runner struct {
	client influxdb2.Client
	org    string
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
