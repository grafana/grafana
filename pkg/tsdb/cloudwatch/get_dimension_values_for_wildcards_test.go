package cloudwatch

import (
	"context"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/patrickmn/go-cache"
	"github.com/stretchr/testify/assert"
)

func TestGetDimensionValuesForWildcards(t *testing.T) {
	executor := &cloudWatchExecutor{tagValueCache: cache.New(0, 0)}
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{ID: 1, Updated: time.Now()},
	}

	t.Run("Should not change non-wildcard dimension value", func(t *testing.T) {
		query := getBaseQuery()
		query.MetricName = "Test_MetricName1"
		query.Dimensions = map[string][]string{"Test_DimensionName1": {"Value1"}}
		queries, err := executor.getDimensionValuesForWildcards(context.Background(), pluginCtx, "us-east-1", nil, []*models.CloudWatchQuery{query})
		assert.Nil(t, err)
		assert.Len(t, queries, 1)
		assert.NotNil(t, queries[0].Dimensions["Test_DimensionName1"], 1)
		assert.Equal(t, []string{"Value1"}, queries[0].Dimensions["Test_DimensionName1"])
	})

	t.Run("Should not change exact dimension value", func(t *testing.T) {
		query := getBaseQuery()
		query.MetricName = "Test_MetricName1"
		query.Dimensions = map[string][]string{"Test_DimensionName1": {"*"}}
		queries, err := executor.getDimensionValuesForWildcards(context.Background(), pluginCtx, "us-east-1", nil, []*models.CloudWatchQuery{query})
		assert.Nil(t, err)
		assert.Len(t, queries, 1)
		assert.NotNil(t, queries[0].Dimensions["Test_DimensionName1"])
		assert.Equal(t, []string{"*"}, queries[0].Dimensions["Test_DimensionName1"])
	})

	t.Run("Should change wildcard dimension value", func(t *testing.T) {
		query := getBaseQuery()
		query.MetricName = "Test_MetricName1"
		query.Dimensions = map[string][]string{"Test_DimensionName1": {"*"}}
		query.MatchExact = false
		api := &mocks.MetricsAPI{Metrics: []*cloudwatch.Metric{
			{MetricName: utils.Pointer("Test_MetricName1"), Dimensions: []*cloudwatch.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Value1")}, {Name: utils.Pointer("Test_DimensionName2"), Value: utils.Pointer("Value2")}}},
			{MetricName: utils.Pointer("Test_MetricName2"), Dimensions: []*cloudwatch.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Value3")}}},
			{MetricName: utils.Pointer("Test_MetricName3"), Dimensions: []*cloudwatch.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Value4")}}},
			{MetricName: utils.Pointer("Test_MetricName4"), Dimensions: []*cloudwatch.Dimension{{Name: utils.Pointer("Test_DimensionName1"), Value: utils.Pointer("Value2")}}},
		}}
		api.On("ListMetricsPages").Return(nil)
		queries, err := executor.getDimensionValuesForWildcards(context.Background(), pluginCtx, "us-east-1", api, []*models.CloudWatchQuery{query})
		assert.Nil(t, err)
		assert.Len(t, queries, 1)
		assert.Equal(t, map[string][]string{"Test_DimensionName1": {"Value1", "Value2", "Value3", "Value4"}}, queries[0].Dimensions)
		api.AssertExpectations(t)
	})

	t.Run("Should use cache for previously fetched value", func(t *testing.T) {
		query := getBaseQuery()
		query.MetricName = "Test_MetricName"
		query.Dimensions = map[string][]string{"Test_DimensionName": {"*"}}
		query.MatchExact = false
		api := &mocks.MetricsAPI{Metrics: []*cloudwatch.Metric{
			{MetricName: utils.Pointer("Test_MetricName"), Dimensions: []*cloudwatch.Dimension{{Name: utils.Pointer("Test_DimensionName"), Value: utils.Pointer("Value")}}},
		}}
		api.On("ListMetricsPages").Return(nil)
		_, err := executor.getDimensionValuesForWildcards(context.Background(), pluginCtx, "us-east-1", api, []*models.CloudWatchQuery{query})
		assert.Nil(t, err)
		// make sure the original query wasn't altered
		assert.Equal(t, map[string][]string{"Test_DimensionName": {"*"}}, query.Dimensions)

		//setting the api to nil confirms that it's using the cached value
		queries, err := executor.getDimensionValuesForWildcards(context.Background(), pluginCtx, "us-east-1", nil, []*models.CloudWatchQuery{query})
		assert.Nil(t, err)
		assert.Len(t, queries, 1)
		assert.Equal(t, map[string][]string{"Test_DimensionName": {"Value"}}, queries[0].Dimensions)
		api.AssertExpectations(t)
	})
}
