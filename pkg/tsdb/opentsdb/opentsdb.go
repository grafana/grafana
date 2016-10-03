package opentsdb

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type OpenTsdbExecutor struct {
	*tsdb.DataSourceInfo
}

func NewOpenTsdbExecutorExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &OpenTsdbExecutor{dsInfo}
}

var (
	plog       log.Logger
	HttpClient http.Client
)

func init() {
	plog = log.New("tsdb.opentsdb")
	tsdb.RegisterExecutor("opentsdb", NewOpenTsdbExecutorExecutor)
}

func (e *OpenTsdbExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) *tsdb.BatchResult {
	panic("Missing implementation")
}
