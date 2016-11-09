package mqe

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MQEExecutor struct {
	*tsdb.DataSourceInfo
}

func NewMQEExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &MQEExecutor{dsInfo}
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
	return &tsdb.BatchResult{}
}
