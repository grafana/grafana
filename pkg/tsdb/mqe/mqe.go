package mqe

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MQEExecutor struct {
	*tsdb.DataSourceInfo
	QueryParser *MQEQueryParser
}

func NewMQEExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &MQEExecutor{
		DataSourceInfo: dsInfo,
		QueryParser:    &MQEQueryParser{},
	}
}

var (
	glog       log.Logger
	HttpClient *http.Client
)

func init() {
	glog = log.New("tsdb.mqe")
	tsdb.RegisterExecutor("mqe", NewMQEExecutor)

	HttpClient = tsdb.GetDefaultClient()
}

func (e *MQEExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	availableSeries, err := NewTokenClient().GetTokenData(ctx, e.DataSourceInfo)
	if err != nil {
		return result.WithError(err)
	}

	glog.Info("available series", availableSeries)

	var mqeQueries []*MQEQuery
	for _, v := range queries {
		q, err := e.QueryParser.Parse(v.Model, e.DataSourceInfo)
		if err != nil {
			return result.WithError(err)
		}
		mqeQueries = append(mqeQueries, q)
	}

	var rawQueries []string
	for _, v := range mqeQueries {
		queries, err := v.Build(availableSeries.Metrics)
		if err != nil {
			return result.WithError(err)
		}

		rawQueries = append(rawQueries, queries...)
	}

	for _, v := range rawQueries {
		glog.Info("Mqe executor", "query", v)
		//create request from v
		//send request
		//parse request
	}

	return result
}
