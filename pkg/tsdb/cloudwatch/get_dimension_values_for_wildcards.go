package cloudwatch

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/clients"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
	"github.com/patrickmn/go-cache"
)

// getDimensionValues gets the actual dimension values for dimensions with a wildcard
func (e *cloudWatchExecutor) getDimensionValuesForWildcards(pluginCtx backend.PluginContext, region string,
	client models.CloudWatchMetricsAPIProvider, origQueries []*models.CloudWatchQuery, tagValueCache *cache.Cache, logger log.Logger) ([]*models.CloudWatchQuery, error) {
	metricsClient := clients.NewMetricsClient(client, e.cfg)
	service := services.NewListMetricsService(metricsClient)
	// create copies of the original query. All the fields besides Dimensions are primitives
	queries := copyQueries(origQueries)

	for _, query := range queries {
		for dimensionKey, values := range query.Dimensions {
			// if the dimension is not a wildcard, skip it
			if len(values) != 1 || query.MatchExact || (len(values) == 1 && values[0] != "*") {
				continue
			}

			accountID := ""
			if query.AccountId != nil {
				accountID = *query.AccountId
			}
			cacheKey := fmt.Sprintf("%s-%s-%s-%s-%s", region, accountID, query.Namespace, query.MetricName, dimensionKey)
			cachedDimensions, found := tagValueCache.Get(cacheKey)
			if found {
				logger.Debug("Fetching dimension values from cache")
				query.Dimensions[dimensionKey] = cachedDimensions.([]string)
				continue
			}

			logger.Debug("Cache miss, fetching dimension values from AWS")
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
				return nil, err
			}
			newDimensions := make([]string, 0, len(dimensions))
			for _, resp := range dimensions {
				newDimensions = append(newDimensions, resp.Value)
			}

			query.Dimensions[dimensionKey] = newDimensions
			if len(newDimensions) > 0 {
				tagValueCache.Set(cacheKey, newDimensions, cache.DefaultExpiration)
			}
		}
	}

	return queries, nil
}

// copyQueries returns a deep copy of the passed in queries
func copyQueries(origQueries []*models.CloudWatchQuery) []*models.CloudWatchQuery {
	newQueries := []*models.CloudWatchQuery{}
	for _, origQuery := range origQueries {
		if origQuery == nil {
			newQueries = append(newQueries, nil)
			continue
		}
		newQuery := *origQuery
		newQuery.Dimensions = map[string][]string{}
		for key, val := range origQuery.Dimensions {
			newQuery.Dimensions[key] = append([]string{}, val...)
		}
		newQueries = append(newQueries, &newQuery)
	}
	return newQueries
}
