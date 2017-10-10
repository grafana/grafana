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

func NewElasticSearchExecutor(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
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
	tsdb.RegisterTsdbQueryEndpoint("elasticsearch", NewElasticSearchExecutor)
}

func (e *ESExecutor) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	if e.Version == 2 {
		return es2.Execute(e.ESDataSource, ctx, ds, query)
	} else if e.Version == 5 {
		return es5.Execute(e.ESDataSource, ctx, ds, query)
	}
	msg := fmt.Sprintf("we do not support for es version %d yet", e.Version)
	result := &tsdb.Response{
		Message: msg,
		Results: map[string]*tsdb.QueryResult{},
	}

	return result, errors.New(msg)
}
