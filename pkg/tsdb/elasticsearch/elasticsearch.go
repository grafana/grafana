package elasticsearch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	pluginmodels "github.com/grafana/grafana/pkg/plugins/models"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
	"github.com/grafana/grafana/pkg/tsdb/interval"
)

// ElasticsearchExecutor represents a handler for handling elasticsearch datasource request
type Executor struct {
	intervalCalculator interval.Calculator
}

// NewExecutor creates a new Executor.
func NewExecutor(*models.DataSource) (pluginmodels.TSDBPlugin, error) {
	return &Executor{
		intervalCalculator: interval.NewCalculator(),
	}, nil
}

// Query handles an elasticsearch datasource request
func (e *Executor) TSDBQuery(ctx context.Context, dsInfo *models.DataSource,
	tsdbQuery pluginmodels.TSDBQuery) (pluginmodels.TSDBResponse, error) {
	if len(tsdbQuery.Queries) == 0 {
		return pluginmodels.TSDBResponse{}, fmt.Errorf("query contains no queries")
	}

	client, err := es.NewClient(ctx, dsInfo, *tsdbQuery.TimeRange)
	if err != nil {
		return pluginmodels.TSDBResponse{}, err
	}

	if tsdbQuery.Debug {
		client.EnableDebug()
	}

	query := newTimeSeriesQuery(client, tsdbQuery, e.intervalCalculator)
	return query.execute()
}
