package elasticsearch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/es2"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/es5"
	esmodel "github.com/grafana/grafana/pkg/tsdb/elasticsearch/models"
	"github.com/pkg/errors"
)

var (
	glog log.Logger
)

type ESExecutor struct {
	*esmodel.ESDataSource
}

func NewElasticSearchExecutor(datasource *models.DataSource) (tsdb.Executor, error) {
	ds, err := esmodel.NewEsDataSource(datasource)
	if err != nil {
		return nil, err
	}
	return &ESExecutor{
		ESDataSource: ds,
	}, nil
}

func init() {
	glog = log.New("tsdb.elasticsearch")
	tsdb.RegisterExecutor("elasticsearch", NewElasticSearchExecutor)
}

func (e *ESExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, query *tsdb.QueryContext) *tsdb.BatchResult {
	if e.Version == 2 {
		return es2.Execute(e.ESDataSource, ctx, queries, query)
	} else {
		return es5.Execute(e.ESDataSource, ctx, queries, query)
	}
	result := &tsdb.BatchResult{
		Error:        errors.New(fmt.Sprintf("we do not support for es version %d yet", e.Version)),
		QueryResults: map[string]*tsdb.QueryResult{},
	}

	return result
}
