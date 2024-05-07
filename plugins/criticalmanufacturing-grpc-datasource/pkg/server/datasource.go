package server

import (
	"context"

	"cmf/grafana-datamanager-datasource/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Datasource interface {
	HandleGetMetricValueQuery(ctx context.Context, query *models.MetricValueQuery) (data.Frames, error)
	HandleGetMetricHistoryQuery(ctx context.Context, query *models.MetricHistoryQuery) (data.Frames, error)
	HandleGetMetricAggregateQuery(ctx context.Context, query *models.MetricAggregateQuery) (data.Frames, error)
	HandleGetMetricTableQuery(ctx context.Context, query *models.MetricTableQuery) (data.Frames, error)
	HandleListDimensionKeysQuery(ctx context.Context, query *models.DimensionKeysQuery) (data.Frames, error)
	HandleListDimensionValuesQuery(ctx context.Context, query *models.DimensionValuesQuery) (data.Frames, error)
	HandleListMetricsQuery(ctx context.Context, query *models.MetricsQuery) (data.Frames, error)
	HandleListDatasetsQuery(ctx context.Context, query *models.DatasetsQuery) (data.Frames, error)
	Dispose()
}
