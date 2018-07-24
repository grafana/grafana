package elasticsearch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

// ElasticsearchExecutor represents a handler for handling elasticsearch datasource request
type ElasticsearchExecutor struct{}

var (
	intervalCalculator tsdb.IntervalCalculator
)

// NewElasticsearchExecutor creates a new elasticsearch executor
func NewElasticsearchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &ElasticsearchExecutor{}, nil
}

func init() {
	intervalCalculator = tsdb.NewIntervalCalculator(nil)
	tsdb.RegisterTsdbQueryEndpoint("elasticsearch", NewElasticsearchExecutor)
}

// Query handles an elasticsearch datasource request
func (e *ElasticsearchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	if len(tsdbQuery.Queries) == 0 {
		return nil, fmt.Errorf("query contains no queries")
	}

	client, err := es.NewClient(ctx, dsInfo, tsdbQuery.TimeRange)
	if err != nil {
		return nil, err
	}

	if tsdbQuery.Debug {
		client.EnableDebug()
	}

	var queryType string
	var query queryEndpoint

	if qt, ok := tsdbQuery.Queries[0].Model.CheckGet("queryType"); ok {
		queryType = qt.MustString("timeseries")
	}

	switch queryType {
	case "fields":
		query = newFieldsQuery(client, tsdbQuery)
	case "terms":
		query = newTermsQuery(client, tsdbQuery)
	case "timeseries":
		fallthrough
	default:
		query = newTimeSeriesQuery(client, tsdbQuery, intervalCalculator)
	}

	return query.execute()
}
