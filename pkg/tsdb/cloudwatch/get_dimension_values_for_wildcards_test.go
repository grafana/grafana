package cloudwatch

import (
	"context"
	"testing"

	cloudwatchtypes "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/patrickmn/go-cache"
	"github.com/stretchr/testify/assert"
)

func noSkip(context.Context, *models.CloudWatchQuery) bool { return false }

func TestGetDimensionValuesForWildcards(t *testing.T) {
	ds := newTestDatasource()
	ctx := context.Background()

	t.Run("Tag value cache", func(t *testing.T) {
		tagValueCache := cache.New(0, 0)

		t.Run("Should use cache for previously fetched value", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricName = "Test_MetricName"
			query.Dimensions = map[string][]string{"Test_DimensionName": {"*"}}
			query.MetricQueryType = models.MetricQueryTypeSearch
			query.MatchExact = false
			api := &mocks.MetricsAPI{Metrics: []cloudwatchtypes.Metric{
				{MetricName: utils.Pointer("Test_MetricName"), Dimensions: []cloudwatchtypes.Dimension{{Name: utils.Pointer("Test_DimensionName"), Value: utils.Pointer("Value")}}},
			}}
			api.On("ListMetrics").Return(nil)
			_, err := ds.getDimensionValuesForWildcards(ctx, "us-east-1", api, []*models.CloudWatchQuery{query}, tagValueCache, 50, noSkip)
			assert.Nil(t, err)
			// make sure the original query wasn't altered
			assert.Equal(t, map[string][]string{"Test_DimensionName": {"*"}}, query.Dimensions)

			//setting the api to nil confirms that it's using the cached value
			queries, err := ds.getDimensionValuesForWildcards(ctx, "us-east-1", nil, []*models.CloudWatchQuery{query}, tagValueCache, 50, noSkip)
			assert.Nil(t, err)
			assert.Len(t, queries, 1)
			assert.Equal(t, map[string][]string{"Test_DimensionName": {"Value"}}, queries[0].Dimensions)
			api.AssertExpectations(t)
		})

		t.Run("Should not cache when no values are returned", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricName = "Test_MetricName"
			query.Dimensions = map[string][]string{"Test_DimensionName2": {"*"}}
			query.MetricQueryType = models.MetricQueryTypeSearch
			query.MatchExact = false
			api := &mocks.MetricsAPI{Metrics: []cloudwatchtypes.Metric{}}
			api.On("ListMetrics").Return(nil)
			queries, err := ds.getDimensionValuesForWildcards(ctx, "us-east-1", api, []*models.CloudWatchQuery{query}, tagValueCache, 50, noSkip)
			assert.Nil(t, err)
			assert.Len(t, queries, 1)
			// assert that the values was set to an empty array
			assert.Equal(t, map[string][]string{"Test_DimensionName2": {}}, queries[0].Dimensions)

			// Confirm that it calls the api again if the last call did not return any values
			api.Metrics = []cloudwatchtypes.Metric{
				{MetricName: utils.Pointer("Test_MetricName"), Dimensions: []cloudwatchtypes.Dimension{{Name: utils.Pointer("Test_DimensionName2"), Value: utils.Pointer("Value")}}},
			}
			api.On("ListMetrics").Return(nil)
			queries, err = ds.getDimensionValuesForWildcards(ctx, "us-east-1", api, []*models.CloudWatchQuery{query}, tagValueCache, 50, noSkip)
			assert.Nil(t, err)
			assert.Len(t, queries, 1)
			assert.Equal(t, map[string][]string{"Test_DimensionName2": {"Value"}}, queries[0].Dimensions)
			api.AssertExpectations(t)
		})
	})

	t.Run("Should skip queries", func(t *testing.T) {
		t.Run("when namespace not set", func(t *testing.T) {
			query := getBaseQuery()
			query.Namespace = ""
			query.MetricName = "Test_MetricName"
			query.Dimensions = map[string][]string{"Test_DimensionName1": {"*"}}
			query.MetricQueryType = models.MetricQueryTypeSearch

			queries, err := ds.getDimensionValuesForWildcards(ctx, "us-east-1", nil, []*models.CloudWatchQuery{query}, cache.New(0, 0), 50, noSkip)
			assert.Nil(t, err)
			assert.Len(t, queries, 1)
			assert.Equal(t, []string{"*"}, queries[0].Dimensions["Test_DimensionName1"])
		})

		t.Run("when metricName not set", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricName = ""
			query.Dimensions = map[string][]string{"Test_DimensionName1": {"*"}}
			query.MetricQueryType = models.MetricQueryTypeSearch

			queries, err := ds.getDimensionValuesForWildcards(ctx, "us-east-1", nil, []*models.CloudWatchQuery{query}, cache.New(0, 0), 50, noSkip)
			assert.Nil(t, err)
			assert.Len(t, queries, 1)
			assert.Equal(t, []string{"*"}, queries[0].Dimensions["Test_DimensionName1"])
		})
	})

	t.Run("MetricSearch query type", func(t *testing.T) {
		t.Run("Should not change non-wildcard dimension value", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricName = "Test_MetricName1"
			query.Dimensions = map[string][]string{"Test_DimensionName1": {"Value1"}}
			query.MetricQueryType = models.MetricQueryTypeSearch
			query.MatchExact = false
			queries, err := ds.getDimensionValuesForWildcards(ctx, "us-east-1", nil, []*models.CloudWatchQuery{query}, cache.New(0, 0), 50, shouldSkipFetchingWildcards)
			assert.Nil(t, err)
			assert.Len(t, queries, 1)
			assert.NotNil(t, queries[0].Dimensions["Test_DimensionName1"], 1)
			assert.Equal(t, []string{"Value1"}, queries[0].Dimensions["Test_DimensionName1"])
		})

		t.Run("Should not change exact dimension value", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricName = "Test_MetricName1"
			query.Dimensions = map[string][]string{"Test_DimensionName1": {"*"}}
			query.MetricQueryType = models.MetricQueryTypeSearch
			queries, err := ds.getDimensionValuesForWildcards(ctx, "us-east-1", nil, []*models.CloudWatchQuery{query}, cache.New(0, 0), 50, shouldSkipFetchingWildcards)
			assert.Nil(t, err)
			assert.Len(t, queries, 1)
			assert.NotNil(t, queries[0].Dimensions["Test_DimensionName1"])
			assert.Equal(t, []string{"*"}, queries[0].Dimensions["Test_DimensionName1"])
		})

		t.Run("Should change wildcard dimension value", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricName = "Test_MetricName1"
			query.Dimensions = map[string][]string{"Test_DimensionName1": {"*"}}
			query.MetricQueryType = models.MetricQueryTypeSearch
			query.MatchExact = false
			api := &mocks.MetricsAPI{Metrics: []cloudwatchtypes.Metric{
				{MetricName: utils.Pointer("Test_MetricName1"), Dimensions: []cloudwatchtypes.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Value1")}, {Name: utils.Pointer("Test_DimensionName2"), Value: utils.Pointer("Value2")}}},
				{MetricName: utils.Pointer("Test_MetricName2"), Dimensions: []cloudwatchtypes.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Value3")}}},
				{MetricName: utils.Pointer("Test_MetricName3"), Dimensions: []cloudwatchtypes.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Value4")}}},
				{MetricName: utils.Pointer("Test_MetricName4"), Dimensions: []cloudwatchtypes.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Value2")}}},
			}}
			api.On("ListMetrics").Return(nil)
			queries, err := ds.getDimensionValuesForWildcards(ctx, "us-east-1", api, []*models.CloudWatchQuery{query}, cache.New(0, 0), 50, shouldSkipFetchingWildcards)
			assert.Nil(t, err)
			assert.Len(t, queries, 1)
			assert.Equal(t, map[string][]string{"Test_DimensionName1": {"Value1", "Value2", "Value3", "Value4"}}, queries[0].Dimensions)
			api.AssertExpectations(t)
		})
	})

	t.Run("MetricQuery query type", func(t *testing.T) {
		t.Run("Should fetch dimensions when there is a `GROUP BY` clause", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricName = "Test_MetricName"
			query.Dimensions = map[string][]string{}
			query.Sql.GroupBy = &models.SQLExpressionGroupBy{
				Expressions: []dataquery.QueryEditorGroupByExpression{
					{
						Property: dataquery.QueryEditorProperty{Name: utils.Pointer("Test_DimensionName1"), Type: "string"},
						Type:     "groupBy",
					},
					{
						Property: dataquery.QueryEditorProperty{Name: utils.Pointer("Test_DimensionName2"), Type: "string"},
						Type:     "groupBy",
					},
				},
				Type: "and",
			}
			query.MetricQueryType = models.MetricQueryTypeQuery

			api := &mocks.MetricsAPI{Metrics: []cloudwatchtypes.Metric{
				{MetricName: utils.Pointer("Test_MetricName"), Dimensions: []cloudwatchtypes.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Dimension1Value1")}, {Name: utils.Pointer("Test_DimensionName2"), Value: utils.Pointer("Dimension2Value1")}}},
				{MetricName: utils.Pointer("Test_MetricName"), Dimensions: []cloudwatchtypes.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Dimension1Value2")}, {Name: utils.Pointer("Test_DimensionName2"), Value: utils.Pointer("Dimension2Value2")}}},
				{MetricName: utils.Pointer("Test_MetricName"), Dimensions: []cloudwatchtypes.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Dimension1Value3")}, {Name: utils.Pointer("Test_DimensionName2"), Value: utils.Pointer("Dimension2Value3")}}},
				{MetricName: utils.Pointer("Test_MetricName"), Dimensions: []cloudwatchtypes.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Dimension1Value4")}, {Name: utils.Pointer("Test_DimensionName2"), Value: utils.Pointer("Dimension2Value4")}}},
			}}
			api.On("ListMetrics").Return(nil)
			queries, err := ds.getDimensionValuesForWildcards(ctx, "us-east-1", api, []*models.CloudWatchQuery{query}, cache.New(0, 0), 50, noSkip)
			assert.Nil(t, err)
			assert.Len(t, queries, 1)
			assert.Equal(t, map[string][]string{
				"Test_DimensionName1": {"Dimension1Value1", "Dimension1Value2", "Dimension1Value3", "Dimension1Value4"},
				"Test_DimensionName2": {"Dimension2Value1", "Dimension2Value2", "Dimension2Value3", "Dimension2Value4"},
			}, queries[0].Dimensions)
			api.AssertExpectations(t)
		})

		t.Run("Should not fetch dimensions when there is not a `GROUP BY` clause", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricName = "Test_MetricName"
			query.Dimensions = map[string][]string{}
			query.MetricQueryType = models.MetricQueryTypeQuery

			queries, err := ds.getDimensionValuesForWildcards(ctx, "us-east-1", nil, []*models.CloudWatchQuery{query}, cache.New(0, 0), 50, noSkip)
			assert.Nil(t, err)
			assert.Len(t, queries, 1)
			assert.Equal(t, map[string][]string{}, queries[0].Dimensions)
		})
	})
}
