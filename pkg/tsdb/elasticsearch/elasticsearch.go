package elasticsearch

import (
	"fmt"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type EsExecutor struct {
	*tsdb.DataSourceInfo
	log log.Logger
}

func NewEsExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &EsExecutor{
		DataSourceInfo: dsInfo,
		log:            log.New("tsdb.elasticsearch"),
	}
}

func init() {
	tsdb.RegisterExecutor("elasticsearch", NewEsExecutor)
}

func (e *EsExecutor) Execute(queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	for _, query := range queries {
		str, _ := query.Query.EncodePretty()
		fmt.Printf("\nElastic query json model: \n%s", str)
		e.log.Info("Elastic query")
	}

	return result
}
