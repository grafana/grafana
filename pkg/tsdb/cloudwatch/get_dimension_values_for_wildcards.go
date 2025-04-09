package cloudwatch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/clients"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
	"github.com/patrickmn/go-cache"
)

func shouldSkipFetchingWildcards(ctx context.Context, q *models.CloudWatchQuery) bool {
	newLabelParsingEnabled := features.IsEnabled(ctx, features.FlagCloudWatchNewLabelParsing)
	if q.MetricQueryType == models.MetricQueryTypeSearch && (q.MatchExact || newLabelParsingEnabled) {
		return true
	}

	if q.MetricQueryType == models.MetricQueryTypeQuery && q.MetricEditorMode == models.MetricEditorModeRaw {
		return true
	}

	return false
}

// getDimensionValues gets the actual dimension values for dimensions with a wildcard
func (e *cloudWatchExecutor) getDimensionValuesForWildcards(
	ctx context.Context,
	region string,
	client models.CloudWatchMetricsAPIProvider,
	origQueries []*models.CloudWatchQuery,
	tagValueCache *cache.Cache,
	listMetricsPageLimit int,
	shouldSkip func(ctx context.Context, query *models.CloudWatchQuery) bool) ([]*models.CloudWatchQuery, error) {
	metricsClient := clients.NewMetricsClient(client, listMetricsPageLimit)
	service := services.NewListMetricsService(metricsClient)
	// create copies of the original query. All the fields besides Dimensions are primitives
	queries := copyQueries(origQueries)
	queries = addWildcardDimensionsForMetricQueryTypeQueries(queries)

	for _, query := range queries {
		if shouldSkip(ctx, query) || query.Namespace == "" || query.MetricName == "" {
			continue
		}
		for dimensionKey, values := range query.Dimensions {
			// if the dimension is not a wildcard, skip it
			if len(values) != 1 || (len(values) == 1 && values[0] != "*") {
				continue
			}

			accountID := ""
			if query.AccountId != nil {
				accountID = *query.AccountId
			}
			cacheKey := fmt.Sprintf("%s-%s-%s-%s-%s", region, accountID, query.Namespace, query.MetricName, dimensionKey)
			cachedDimensions, found := tagValueCache.Get(cacheKey)
			if found {
				e.logger.FromContext(ctx).Debug("Fetching dimension values from cache")
				query.Dimensions[dimensionKey] = cachedDimensions.([]string)
				continue
			}

			e.logger.FromContext(ctx).Debug("Cache miss, fetching dimension values from AWS")
			request := resources.DimensionValuesRequest{
				ResourceRequest: &resources.ResourceRequest{
					Region:    region,
					AccountId: query.AccountId,
				},
				Namespace:    query.Namespace,
				MetricName:   query.MetricName,
				DimensionKey: dimensionKey,
			}

			dimensions, err := service.GetDimensionValuesByDimensionFilter(ctx, request)
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

// addWildcardDimensionsForMetricQueryTypeQueries adds wildcard dimensions if there is
// a `GROUP BY` clause in the query. This is used for MetricQuery type queries so we can
// build labels when we build the data frame.
func addWildcardDimensionsForMetricQueryTypeQueries(queries []*models.CloudWatchQuery) []*models.CloudWatchQuery {
	for i, q := range queries {
		if q.MetricQueryType != models.MetricQueryTypeQuery || q.MetricEditorMode == models.MetricEditorModeRaw || q.Sql.GroupBy == nil || len(q.Sql.GroupBy.Expressions) == 0 {
			continue
		}

		for _, expr := range q.Sql.GroupBy.Expressions {
			if expr.Property.Name != nil && *expr.Property.Name != "" {
				queries[i].Dimensions[*expr.Property.Name] = []string{"*"}
			}
		}
	}

	return queries
}
