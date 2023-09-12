package cloudwatch

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
)

func TestGetDimensionValues(t *testing.T) {
	api := &mocks.MetricsAPI{Metrics: []*cloudwatch.Metric{
		{MetricName: aws.String("Test_MetricName1"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1"), Value: aws.String("Value1")}, {Name: aws.String("Test_DimensionName2"), Value: aws.String("Value2")}}},
		{MetricName: aws.String("Test_MetricName2"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1"), Value: aws.String("Value3")}}},
		{MetricName: aws.String("Test_MetricName3"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1"), Value: aws.String("Value4")}}},
		{MetricName: aws.String("Test_MetricName4"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1"), Value: aws.String("Value2")}}},
	}}
	executor := &cloudWatchExecutor{}

	t.Run("Should not change non-wildcard dimension value", func(t *testing.T) {
		query := getBaseQuery()
		query.MetricName = "Test_MetricName1"
		query.Dimensions = map[string][]string{"Test_DimensionName1": {"Value1"}}
		queries, err := executor.getDimensionValues(context.Background(), api, "us-east-1", []*models.CloudWatchQuery{query})
		assert.Nil(t, err)
		assert.Len(t, queries, 1)
		assert.NotNil(t, queries[0].Dimensions["Test_DimensionName1"], 1)
		assert.Equal(t, []string{"Value1"}, queries[0].Dimensions["Test_DimensionName1"])
	})

	t.Run("Should not change exact dimension value", func(t *testing.T) {
		query := getBaseQuery()
		query.MetricName = "Test_MetricName1"
		query.Dimensions = map[string][]string{"Test_DimensionName1": {"*"}}
		queries, err := executor.getDimensionValues(context.Background(), api, "us-east-1", []*models.CloudWatchQuery{query})
		assert.Nil(t, err)
		assert.Len(t, queries, 1)
		assert.NotNil(t, queries[0].Dimensions["Test_DimensionName1"], 1)
		assert.Equal(t, []string{"*"}, queries[0].Dimensions["Test_DimensionName1"])
	})

	t.Run("Should change wildcard dimension value", func(t *testing.T) {
		query := getBaseQuery()
		query.MetricName = "Test_MetricName1"
		query.Dimensions = map[string][]string{"Test_DimensionName1": {"*"}}
		query.MatchExact = false
		queries, err := executor.getDimensionValues(context.Background(), api, "us-east-1", []*models.CloudWatchQuery{query})
		assert.Nil(t, err)
		assert.Len(t, queries, 1)
		assert.NotNil(t, queries[0].Dimensions["Test_DimensionName1"], 1)
		assert.Equal(t, []string{"Value1", "Value2", "Value3", "Value4"}, queries[0].Dimensions["Test_DimensionName1"])
	})
}
