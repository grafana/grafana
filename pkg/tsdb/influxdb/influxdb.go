package influxdb

import (
	"context"
	"crypto/tls"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type InfluxDBExecutor struct {
	*tsdb.DataSourceInfo
	QueryParser *InfluxdbQueryParser
}

func NewInfluxDBExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &InfluxDBExecutor{
		DataSourceInfo: dsInfo,
		QueryParser:    &InfluxdbQueryParser{},
	}
}

var (
	glog       log.Logger
	HttpClient *http.Client
)

func init() {
	glog = log.New("tsdb.influxdb")
	tsdb.RegisterExecutor("influxdb", NewInfluxDBExecutor)

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	HttpClient = &http.Client{
		Timeout:   time.Duration(15 * time.Second),
		Transport: tr,
	}
}

func (e *InfluxDBExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}
	for _, v := range queries {

		query, err := e.QueryParser.Parse(v.Model)

		if err != nil {
			result.Error = err
			return result
		}
		glog.Info("Influxdb executor", "query", query)
	}

	return result
}
