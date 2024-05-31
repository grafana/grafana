package cloudwatch

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMetricDataQueryBuilder(t *testing.T) {
	executor := newExecutor(nil, log.NewNullLogger())
	t.Run("buildMetricDataQuery", func(t *testing.T) {
		t.Run("should use metric stat", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricEditorMode = models.MetricEditorModeBuilder
			query.MetricQueryType = models.MetricQueryTypeSearch
			mdq, err := executor.buildMetricDataQuery(context.Background(), query)
			require.NoError(t, err)
			require.Empty(t, mdq.Expression)
			assert.Equal(t, query.MetricName, *mdq.MetricStat.Metric.MetricName)
			assert.Equal(t, query.Namespace, *mdq.MetricStat.Metric.Namespace)
		})

		t.Run("should pass AccountId in metric stat query", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricEditorMode = models.MetricEditorModeBuilder
			query.MetricQueryType = models.MetricQueryTypeSearch
			query.AccountId = aws.String("some account id")
			mdq, err := executor.buildMetricDataQuery(context.Background(), query)
			require.NoError(t, err)
			assert.Equal(t, "some account id", *mdq.AccountId)
		})

		t.Run("should leave AccountId in metric stat query", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricEditorMode = models.MetricEditorModeBuilder
			query.MetricQueryType = models.MetricQueryTypeSearch
			mdq, err := executor.buildMetricDataQuery(context.Background(), query)
			require.NoError(t, err)
			assert.Nil(t, mdq.AccountId)
		})

		t.Run("should use custom built expression", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricEditorMode = models.MetricEditorModeBuilder
			query.MetricQueryType = models.MetricQueryTypeSearch
			query.MatchExact = false
			mdq, err := executor.buildMetricDataQuery(context.Background(), query)
			require.NoError(t, err)
			require.Nil(t, mdq.MetricStat)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"="lb1"', '', 300))`, *mdq.Expression)
		})

		t.Run("should use sql expression", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricEditorMode = models.MetricEditorModeRaw
			query.MetricQueryType = models.MetricQueryTypeQuery
			query.SqlExpression = `SELECT SUM(CPUUTilization) FROM "AWS/EC2"`
			mdq, err := executor.buildMetricDataQuery(context.Background(), query)
			require.NoError(t, err)
			require.Nil(t, mdq.MetricStat)
			assert.Equal(t, query.SqlExpression, *mdq.Expression)
		})

		t.Run("should use user defined math expression", func(t *testing.T) {
			query := getBaseQuery()
			query.MetricEditorMode = models.MetricEditorModeRaw
			query.MetricQueryType = models.MetricQueryTypeSearch
			query.Expression = `SUM(x+y)`
			mdq, err := executor.buildMetricDataQuery(context.Background(), query)
			require.NoError(t, err)
			require.Nil(t, mdq.MetricStat)
			assert.Equal(t, query.Expression, *mdq.Expression)
		})

		t.Run("should set period in user defined expression", func(t *testing.T) {
			executor := newExecutor(nil, log.NewNullLogger())
			query := getBaseQuery()
			query.MetricEditorMode = models.MetricEditorModeRaw
			query.MetricQueryType = models.MetricQueryTypeSearch
			query.MatchExact = false
			query.Expression = `SUM([a,b])`
			mdq, err := executor.buildMetricDataQuery(context.Background(), query)
			require.NoError(t, err)
			require.Nil(t, mdq.MetricStat)
			assert.Equal(t, int64(300), *mdq.Period)
			assert.Equal(t, `SUM([a,b])`, *mdq.Expression)
		})

		t.Run("should set label", func(t *testing.T) {
			executor := newExecutor(nil, log.NewNullLogger())
			query := getBaseQuery()
			query.Label = "some label"

			mdq, err := executor.buildMetricDataQuery(context.Background(), query)

			assert.NoError(t, err)
			require.NotNil(t, mdq.Label)
			assert.Equal(t, "some label", *mdq.Label)
		})

		t.Run("should not set label for empty string query label", func(t *testing.T) {
			executor := newExecutor(nil, log.NewNullLogger())
			query := getBaseQuery()
			query.Label = ""

			mdq, err := executor.buildMetricDataQuery(context.Background(), query)

			assert.NoError(t, err)
			assert.Nil(t, mdq.Label)
		})

		t.Run(`should not specify accountId when it is "all"`, func(t *testing.T) {
			executor := newExecutor(nil, log.NewNullLogger())
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Statistic:  "Average",
				Period:     60,
				MatchExact: false,
				AccountId:  aws.String("all"),
			}

			mdq, err := executor.buildMetricDataQuery(context.Background(), query)

			assert.NoError(t, err)
			require.Nil(t, mdq.MetricStat)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization"', 'Average', 60))`, *mdq.Expression)
		})

		t.Run("should set accountId when it is specified", func(t *testing.T) {
			executor := newExecutor(nil, log.NewNullLogger())
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Statistic:  "Average",
				Period:     60,
				MatchExact: false,
				AccountId:  aws.String("12345"),
			}

			mdq, err := executor.buildMetricDataQuery(context.Background(), query)

			assert.NoError(t, err)
			require.Nil(t, mdq.MetricStat)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" :aws.AccountId="12345"', 'Average', 60))`, *mdq.Expression)
		})
	})

	t.Run("Query should be matched exact", func(t *testing.T) {
		const matchExact = true

		t.Run("Query has three dimension values for a given dimension key", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2", "lb3"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/EC2","LoadBalancer"} MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("Query has three dimension values for two given dimension keys", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2", "lb3"},
					"InstanceId":   {"i-123", "i-456", "i-789"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/EC2","InstanceId","LoadBalancer"} MetricName="CPUUtilization" "InstanceId"=("i-123" OR "i-456" OR "i-789") "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.InstanceId')}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("Query has one dimension key with a * value", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"*"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/EC2","LoadBalancer"} MetricName="CPUUtilization"', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("Query has three dimension values for two given dimension keys, and one value is a star", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2", "lb3"},
					"InstanceId":   {"i-123", "*", "i-789"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/EC2","InstanceId","LoadBalancer"} MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.InstanceId')}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("Query has multiple dimensions and an account Id", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2", "lb3"},
					"InstanceId":   {"i-123", "*", "i-789"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				AccountId:        aws.String("some account id"),
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/EC2","InstanceId","LoadBalancer"} MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3") :aws.AccountId="some account id"', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.InstanceId')}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("Query has a dimension key with a space", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/Kafka",
				MetricName: "CpuUser",
				Dimensions: map[string][]string{
					"Cluster Name": {"dev-cluster", "prod-cluster"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/Kafka","Cluster Name"} MetricName="CpuUser" "Cluster Name"=("dev-cluster" OR "prod-cluster")', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.Cluster Name')}", *mdq.Label)
		})

		t.Run("Query has a custom namespace contains spaces", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "Test-API Cache by Minute",
				MetricName: "CpuUser",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2", "lb3"},
					"InstanceId":   {"i-123", "*", "i-789"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"Test-API Cache by Minute","InstanceId","LoadBalancer"} MetricName="CpuUser" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.InstanceId')}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("Query has a custom label", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "CPUUtilization",
				MetricName: "CpuUser",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1"},
					"InstanceId":   {"i-123", "*", "i-789"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				Label:            "LB: ${PROP('Dim.LoadBalancer')",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"CPUUtilization","InstanceId","LoadBalancer"} MetricName="CpuUser" "LoadBalancer"="lb1"', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "LB: ${PROP('Dim.LoadBalancer')|&|${PROP('Dim.InstanceId')}", *mdq.Label)
		})
	})

	t.Run("Query should not be matched exact", func(t *testing.T) {
		const matchExact = false

		t.Run("Query has three dimension values for a given dimension key", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2", "lb3"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("Query has three dimension values for two given dimension keys", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2", "lb3"},
					"InstanceId":   {"i-123", "i-456", "i-789"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "InstanceId"=("i-123" OR "i-456" OR "i-789") "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.InstanceId')}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("Query has one dimension key with a * value", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"*"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("query has three dimension values for two given dimension keys, and one value is a star", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2", "lb3"},
					"InstanceId":   {"i-123", "*", "i-789"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3") "InstanceId"', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.InstanceId')}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("query has multiple dimensions and an account Id", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2", "lb3"},
					"InstanceId":   {"i-123", "*", "i-789"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				AccountId:        aws.String("some account id"),
				Statistic:        "Average",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3") "InstanceId" :aws.AccountId="some account id"', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "${LABEL}|&|${PROP('Dim.InstanceId')}|&|${PROP('Dim.LoadBalancer')}", *mdq.Label)
		})

		t.Run("Query has a custom label", func(t *testing.T) {
			query := &models.CloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1"},
					"InstanceId":   {"i-123", "*", "i-789"},
				},
				Period:           300,
				Expression:       "",
				MatchExact:       matchExact,
				Statistic:        "Average",
				Label:            "LB: ${PROP('Dim.LoadBalancer')",
				MetricQueryType:  models.MetricQueryTypeSearch,
				MetricEditorMode: models.MetricEditorModeBuilder,
			}

			mdq, err := executor.buildMetricDataQuery(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), query)
			require.NoError(t, err)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"="lb1" "InstanceId"', 'Average', 300))`, *mdq.Expression)
			assert.Equal(t, "LB: ${PROP('Dim.LoadBalancer')|&|${PROP('Dim.InstanceId')}", *mdq.Label)
		})
	})

	t.Run("Query has invalid characters in dimension values", func(t *testing.T) {
		query := &models.CloudWatchQuery{
			Namespace:  "AWS/EC2",
			MetricName: "CPUUtilization",
			Dimensions: map[string][]string{
				"lb4": {`lb4's""'`},
			},
			Period:     300,
			Expression: "",
			MatchExact: true,
		}
		res := buildSearchExpression(query, "Average")

		assert.Contains(t, res, `lb4\'s\"\"\'`, "Expected escaped quotes")
	})
}

func getBaseQuery() *models.CloudWatchQuery {
	query := &models.CloudWatchQuery{
		Namespace:  "AWS/EC2",
		MetricName: "CPUUtilization",
		Dimensions: map[string][]string{
			"LoadBalancer": {"lb1"},
		},
		Period:     300,
		Expression: "",
		MatchExact: true,
	}
	return query
}
