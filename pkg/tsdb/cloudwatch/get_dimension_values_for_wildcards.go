package cloudwatch

import (
	"context"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/clients"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

// getDimensionValues gets the actual dimension values for dimensions with a wildcard
func (e *cloudWatchExecutor) getDimensionValuesForWildcards(ctx context.Context, client models.CloudWatchMetricsAPIProvider, region string, queries []*models.CloudWatchQuery) ([]*models.CloudWatchQuery, error) {
	metricsClient := clients.NewMetricsClient(client, e.cfg)
	service := services.NewListMetricsService(metricsClient)

	for _, query := range queries {
		for dimensionKey, values := range query.Dimensions {
			// if the dimension is not a wildcard, skip it
			if len(values) != 1 || query.MatchExact || (len(values) == 1 && values[0] != "*") {
				continue
			}

			request := resources.DimensionValuesRequest{
				ResourceRequest: &resources.ResourceRequest{
					Region:    region,
					AccountId: query.AccountId,
				},
				Namespace:    query.Namespace,
				MetricName:   query.MetricName,
				DimensionKey: dimensionKey,
			}

			dimensions, err := service.GetDimensionValuesByDimensionFilter(request)
			if err != nil {
				return queries, err
			}

			newDimensions := make([]string, 0, len(dimensions))
			for _, resp := range dimensions {
				newDimensions = append(newDimensions, resp.Value)
			}
			query.Dimensions[dimensionKey] = newDimensions
		}
	}

	return queries, nil
}
