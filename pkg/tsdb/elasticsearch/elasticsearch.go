package elasticsearch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
	"github.com/grafana/grafana/pkg/tsdb/interval"
)

// Executor represents a handler for handling elasticsearch datasource request
type Executor struct {
	intervalCalculator interval.Calculator
}

// NewExecutor creates a new Executor.
func NewExecutor(*models.DataSource) (plugins.DataPlugin, error) {
	return &Executor{
		intervalCalculator: interval.NewCalculator(),
	}, nil
}

// DataQuery handles an elasticsearch datasource request
func (e *Executor) DataQuery(ctx context.Context, dsInfo *models.DataSource,
	tsdbQuery plugins.DataQuery) (plugins.DataResponse, error) {
	if len(tsdbQuery.Queries) == 0 {
		return plugins.DataResponse{}, fmt.Errorf("query contains no queries")
	}

	client, err := es.NewClient(ctx, dsInfo, *tsdbQuery.TimeRange)
	if err != nil {
		return plugins.DataResponse{}, err
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
	case "timeseries":
		fallthrough
	default:
		query = newTimeSeriesQuery(client, tsdbQuery, e.intervalCalculator)
	}

	return query.execute()
}
