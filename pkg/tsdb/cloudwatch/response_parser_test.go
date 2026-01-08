package cloudwatch

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	cloudwatchtypes "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func loadGetMetricDataOutputsFromFile(filePath string) ([]*cloudwatch.GetMetricDataOutput, error) {
	var getMetricDataOutputs []*cloudwatch.GetMetricDataOutput
	cleanFilePath := filepath.Clean(filePath)
	jsonBody, err := os.ReadFile(cleanFilePath)
	if err != nil {
		return getMetricDataOutputs, err
	}
	err = json.Unmarshal(jsonBody, &getMetricDataOutputs)
	return getMetricDataOutputs, err
}

func TestCloudWatchResponseParser(t *testing.T) {
	t.Run("when aggregating multi-outputs response", func(t *testing.T) {
		getMetricDataOutputs, err := loadGetMetricDataOutputsFromFile("./testdata/multiple-outputs-query-a.json")
		require.NoError(t, err)
		aggregatedResponse := aggregateResponse(getMetricDataOutputs)
		idA := "a"
		t.Run("should have two labels", func(t *testing.T) {
			assert.Len(t, aggregatedResponse[idA].Metrics, 2)
		})
		t.Run("should have points for label1 taken from both getMetricDataOutputs", func(t *testing.T) {
			require.NotNil(t, *aggregatedResponse[idA].Metrics[0].Label)
			require.Equal(t, "label1", *aggregatedResponse[idA].Metrics[0].Label)
			assert.Len(t, aggregatedResponse[idA].Metrics[0].Values, 10)
		})
		t.Run("should have statuscode 'Complete'", func(t *testing.T) {
			assert.Equal(t, cloudwatchtypes.StatusCodeComplete, aggregatedResponse[idA].StatusCode)
		})
		t.Run("should have exceeded request limit", func(t *testing.T) {
			assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxMetricsExceeded"])
		})
		t.Run("should have exceeded query time range", func(t *testing.T) {
			assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxQueryTimeRangeExceeded"])
		})
		t.Run("should have exceeded max query results", func(t *testing.T) {
			assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxQueryResultsExceeded"])
		})
		t.Run("should have exceeded max matching results", func(t *testing.T) {
			assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxMatchingResultsExceeded"])
		})
	})

	t.Run("when aggregating multi-outputs response with PartialData and ArithmeticError", func(t *testing.T) {
		getMetricDataOutputs, err := loadGetMetricDataOutputsFromFile("./testdata/multiple-outputs-query-b.json")
		require.NoError(t, err)
		aggregatedResponse := aggregateResponse(getMetricDataOutputs)
		idB := "b"
		t.Run("should have statuscode is 'PartialData'", func(t *testing.T) {
			assert.Equal(t, cloudwatchtypes.StatusCodePartialData, aggregatedResponse[idB].StatusCode)
		})
		t.Run("should have an arithmetic error and an error message", func(t *testing.T) {
			assert.True(t, aggregatedResponse[idB].HasArithmeticError)
			assert.Equal(t, "One or more data-points have been dropped due to non-numeric values (NaN, -Infinite, +Infinite)", aggregatedResponse[idB].ArithmeticErrorMessage)
		})
	})

	t.Run("when aggregating multi-outputs response", func(t *testing.T) {
		getMetricDataOutputs, err := loadGetMetricDataOutputsFromFile("./testdata/single-output-multiple-metric-data-results.json")
		require.NoError(t, err)
		aggregatedResponse := aggregateResponse(getMetricDataOutputs)
		idA := "a"
		t.Run("should have one label", func(t *testing.T) {
			assert.Len(t, aggregatedResponse[idA].Metrics, 1)
		})
		t.Run("should have points for label1 taken from both MetricDataResults", func(t *testing.T) {
			require.NotNil(t, *aggregatedResponse[idA].Metrics[0].Label)
			require.Equal(t, "label1", *aggregatedResponse[idA].Metrics[0].Label)
			assert.Len(t, aggregatedResponse[idA].Metrics[0].Values, 6)
		})
		t.Run("should have statuscode 'Complete'", func(t *testing.T) {
			assert.Equal(t, cloudwatchtypes.StatusCodeComplete, aggregatedResponse[idA].StatusCode)
		})
	})

	t.Run("when aggregating response and error codes are in first GetMetricDataOutput", func(t *testing.T) {
		getMetricDataOutputs, err := loadGetMetricDataOutputsFromFile("./testdata/multiple-outputs2.json")
		require.NoError(t, err)
		aggregatedResponse := aggregateResponse(getMetricDataOutputs)
		t.Run("response for id a", func(t *testing.T) {
			idA := "a"
			t.Run("should have exceeded request limit", func(t *testing.T) {
				assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxMetricsExceeded"])
			})
			t.Run("should have exceeded query time range", func(t *testing.T) {
				assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxQueryTimeRangeExceeded"])
			})
			t.Run("should have exceeded max query results", func(t *testing.T) {
				assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxQueryResultsExceeded"])
			})
			t.Run("should have exceeded max matching results", func(t *testing.T) {
				assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxMatchingResultsExceeded"])
			})
		})
	})

	t.Run("when aggregating response and error codes are in second GetMetricDataOutput", func(t *testing.T) {
		getMetricDataOutputs, err := loadGetMetricDataOutputsFromFile("./testdata/multiple-outputs3.json")
		require.NoError(t, err)
		aggregatedResponse := aggregateResponse(getMetricDataOutputs)
		t.Run("response for id a", func(t *testing.T) {
			idA := "a"
			idB := "b"
			t.Run("should have exceeded request limit", func(t *testing.T) {
				assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxMetricsExceeded"])
				assert.True(t, aggregatedResponse[idB].ErrorCodes["MaxMetricsExceeded"])
			})
			t.Run("should have exceeded query time range", func(t *testing.T) {
				assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxQueryTimeRangeExceeded"])
				assert.True(t, aggregatedResponse[idB].ErrorCodes["MaxQueryTimeRangeExceeded"])
			})
			t.Run("should have exceeded max query results", func(t *testing.T) {
				assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxQueryResultsExceeded"])
				assert.True(t, aggregatedResponse[idB].ErrorCodes["MaxQueryResultsExceeded"])
			})
			t.Run("should have exceeded max matching results", func(t *testing.T) {
				assert.True(t, aggregatedResponse[idA].ErrorCodes["MaxMatchingResultsExceeded"])
				assert.True(t, aggregatedResponse[idB].ErrorCodes["MaxMatchingResultsExceeded"])
			})
		})
	})

	t.Run("when receiving a permissions error should pass it to the user", func(t *testing.T) {
		getMetricDataOutputs, err := loadGetMetricDataOutputsFromFile("./testdata/permissions-error-output.json")
		require.NoError(t, err)
		aggregatedResponse := aggregateResponse(getMetricDataOutputs)

		assert.True(t, aggregatedResponse["a"].HasPermissionError)
		assert.Equal(t, "Access denied when getting data - please check that you have the pi:GetResourceMetrics permission", aggregatedResponse["a"].PermissionErrorMessage)
	})
}

func Test_buildDataFrames_parse_label_to_name_and_labels(t *testing.T) {
	startTime := time.Now()
	endTime := startTime.Add(2 * time.Hour)

	t.Run("using multi filter", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("id1"),
					Label: aws.String("lb1|&|lb1"),
					Timestamps: []time.Time{
						timestamp,
						timestamp.Add(time.Minute),
						timestamp.Add(3 * time.Minute),
					},
					Values: []float64{
						10,
						20,
						30,
					},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
				{
					Id:    aws.String("id2"),
					Label: aws.String("lb2|&|lb2"),
					Timestamps: []time.Time{
						timestamp,
						timestamp.Add(time.Minute),
						timestamp.Add(3 * time.Minute),
					},
					Values: []float64{
						10,
						20,
						30,
					},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:  startTime,
			EndTime:    endTime,
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1", "lb2"},
				"TargetGroup":  {"tg"},
			},
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeBuilder,
			MatchExact:       true,
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		frame1 := frames[0]
		assert.Equal(t, "lb1", frame1.Name)
		assert.Equal(t, "lb1", frame1.Fields[1].Labels["Series"])
		assert.Equal(t, "lb1", frame1.Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, "tg", frame1.Fields[1].Labels["TargetGroup"])

		frame2 := frames[1]
		assert.Equal(t, "lb2", frame2.Name)
		assert.Equal(t, "lb2", frame2.Fields[1].Labels["Series"])
		assert.Equal(t, "lb2", frame2.Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, "tg", frame2.Fields[1].Labels["TargetGroup"])
	})

	t.Run("using multiple wildcard filters", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("lb3"),
					Label: aws.String("some label lb3|&|inst1|&|balancer 1"),
					Timestamps: []time.Time{
						timestamp,
						timestamp.Add(time.Minute),
						timestamp.Add(3 * time.Minute),
					},
					Values: []float64{
						10,
						20,
						30,
					},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
				{
					Id:    aws.String("lb4"),
					Label: aws.String("some label lb4|&|inst2|&|balancer 2"),
					Timestamps: []time.Time{
						timestamp,
						timestamp.Add(time.Minute),
						timestamp.Add(3 * time.Minute),
					},
					Values: []float64{
						10,
						20,
						30,
					},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:  startTime,
			EndTime:    endTime,
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"*"},
				"InstanceType": {"*"},
				"TargetGroup":  {"tg"},
			},
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeBuilder,
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		assert.Equal(t, "some label lb3", frames[0].Name)
		assert.Equal(t, "some label lb3", frames[0].Fields[1].Labels["Series"])
		assert.Equal(t, "balancer 1", frames[0].Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, "inst1", frames[0].Fields[1].Labels["InstanceType"])
		assert.Equal(t, "tg", frames[0].Fields[1].Labels["TargetGroup"])

		assert.Equal(t, "some label lb4", frames[1].Name)
		assert.Equal(t, "some label lb4", frames[1].Fields[1].Labels["Series"])
		assert.Equal(t, "balancer 2", frames[1].Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, "inst2", frames[1].Fields[1].Labels["InstanceType"])
		assert.Equal(t, "tg", frames[1].Fields[1].Labels["TargetGroup"])
	})

	t.Run("when no values are returned and a multi-valued template variable is used", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		// When there are no results, CloudWatch sets the label values to --
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("lb3"),
					Label: aws.String("some label|&|--"),
					Timestamps: []time.Time{
						timestamp,
						timestamp.Add(time.Minute),
						timestamp.Add(3 * time.Minute),
					},
					Values:     []float64{},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}
		query := &models.CloudWatchQuery{
			StartTime:  startTime,
			EndTime:    endTime,
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1", "lb2"},
			},
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeBuilder,
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		assert.Len(t, frames, 2)
		assert.Equal(t, "some label", frames[0].Name)
		assert.Equal(t, "lb1", frames[0].Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, "some label", frames[1].Name)
		assert.Equal(t, "lb2", frames[1].Fields[1].Labels["LoadBalancer"])
	})

	t.Run("when no values are returned and a multi-valued template variable and two single-valued dimensions are used", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		// When there are no results, CloudWatch sets the label values to --
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("lb3"),
					Label: aws.String("some label|&|--"),
					Timestamps: []time.Time{
						timestamp,
						timestamp.Add(time.Minute),
						timestamp.Add(3 * time.Minute),
					},
					Values:     []float64{},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:  startTime,
			EndTime:    endTime,
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1", "lb2"},
				"InstanceType": {"micro"},
				"Resource":     {"res"},
			},
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeBuilder,
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		assert.Len(t, frames, 2)
		assert.Equal(t, "some label", frames[0].Name)
		assert.Equal(t, "lb1", frames[0].Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, "micro", frames[0].Fields[1].Labels["InstanceType"])
		assert.Equal(t, "res", frames[0].Fields[1].Labels["Resource"])

		assert.Equal(t, "some label", frames[1].Name)
		assert.Equal(t, "lb2", frames[1].Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, "micro", frames[1].Fields[1].Labels["InstanceType"])
		assert.Equal(t, "res", frames[1].Fields[1].Labels["Resource"])
	})

	t.Run("when not using multi-value dimension filters on a `MetricSearch` query", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("lb3"),
					Label: aws.String("some label"),
					Timestamps: []time.Time{
						timestamp,
					},
					Values:     []float64{23},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:  startTime,
			EndTime:    endTime,
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1"},
				"InstanceType": {"micro"},
				"Resource":     {"res"},
			},
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeBuilder,
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		assert.Equal(t, "some label", frames[0].Name)
		assert.Equal(t, "lb1", frames[0].Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, "micro", frames[0].Fields[1].Labels["InstanceType"])
		assert.Equal(t, "res", frames[0].Fields[1].Labels["Resource"])
	})

	t.Run("when non-static label set on a `MetricSearch` query", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("lb3"),
					Label: aws.String("some label|&|res"),
					Timestamps: []time.Time{
						timestamp,
					},
					Values:     []float64{23},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:  startTime,
			EndTime:    endTime,
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1"},
				"InstanceType": {"micro"},
				"Resource":     {"*"},
			},
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeBuilder,
			Label:            "set ${AVG} label",
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		assert.Equal(t, "some label", frames[0].Name)
		assert.Equal(t, "lb1", frames[0].Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, "micro", frames[0].Fields[1].Labels["InstanceType"])
		assert.Equal(t, "res", frames[0].Fields[1].Labels["Resource"])
	})

	t.Run("when static label set on a `MetricSearch` query", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("lb3"),
					Label: aws.String("some label|&|res"),
					Timestamps: []time.Time{
						timestamp,
					},
					Values:     []float64{23},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:  startTime,
			EndTime:    endTime,
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb1"},
				"InstanceType": {"micro"},
				"Resource":     {"*"},
			},
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeBuilder,
			Label:            "actual",
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		assert.Equal(t, "actual", frames[0].Name)
		assert.Equal(t, "lb1", frames[0].Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, "micro", frames[0].Fields[1].Labels["InstanceType"])
		assert.Equal(t, "res", frames[0].Fields[1].Labels["Resource"])
	})

	t.Run("when code editor used for `MetricSearch` query add fallback label", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("lb3"),
					Label: aws.String("some label"),
					Timestamps: []time.Time{
						timestamp,
					},
					Values:     []float64{23},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:        startTime,
			EndTime:          endTime,
			RefId:            "refId1",
			Region:           "us-east-1",
			Namespace:        "",
			MetricName:       "",
			Expression:       "SEARCH('MetricName=\"ResourceCount\" AND (\"AWS/Usage\") AND Resource=TargetsPer NOT QueueName=TargetsPerNetworkLoadBalancer', 'Average')",
			Dimensions:       map[string][]string{},
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeRaw,
			Label:            "actual",
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		assert.Equal(t, "actual", frames[0].Name)
		assert.Equal(t, "some label", frames[0].Fields[1].Labels["Series"])
	})

	t.Run("when `MetricQuery` query has no label set and `GROUP BY` clause has multiple fields", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("query1"),
					Label: aws.String("EC2 vCPU"),
					Timestamps: []time.Time{
						timestamp,
					},
					Values:     []float64{23},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
				{
					Id:    aws.String("query2"),
					Label: aws.String("Elastic Loading Balancing ApplicationLoadBalancersPerRegion"),
					Timestamps: []time.Time{
						timestamp,
					},
					Values:     []float64{23},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:        startTime,
			EndTime:          endTime,
			RefId:            "refId1",
			Region:           "us-east-1",
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeQuery,
			MetricEditorMode: models.MetricEditorModeBuilder,
			Dimensions:       map[string][]string{"Service": {"EC2", "Elastic Loading Balancing"}, "Resource": {"vCPU", "ApplicationLoadBalancersPerRegion"}},
			SqlExpression:    "SELECT AVG(ResourceCount) FROM SCHEMA(\"AWS/Usage\", Class, Resource, Service, Type) GROUP BY Service, Resource",
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		assert.Equal(t, "EC2 vCPU", frames[0].Name)
		assert.Equal(t, "EC2", frames[0].Fields[1].Labels["Service"])
		assert.Equal(t, "vCPU", frames[0].Fields[1].Labels["Resource"])
		assert.Equal(t, "Elastic Loading Balancing ApplicationLoadBalancersPerRegion", frames[1].Name)
		assert.Equal(t, "Elastic Loading Balancing", frames[1].Fields[1].Labels["Service"])
		assert.Equal(t, "ApplicationLoadBalancersPerRegion", frames[1].Fields[1].Labels["Resource"])
	})

	t.Run("when `MetricQuery` query has no `GROUP BY` clause", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("query1"),
					Label: aws.String("cloudwatch-default-label"),
					Timestamps: []time.Time{
						timestamp,
					},
					Values:     []float64{23},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:        startTime,
			EndTime:          endTime,
			RefId:            "refId1",
			Region:           "us-east-1",
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeQuery,
			MetricEditorMode: models.MetricEditorModeBuilder,
			SqlExpression:    "SELECT AVG(ResourceCount) FROM SCHEMA(\"AWS/Usage\", Class, Resource, Service, Type)",
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		assert.Equal(t, "cloudwatch-default-label", frames[0].Name)
		assert.Equal(t, "cloudwatch-default-label", frames[0].Fields[1].Labels["Series"])
	})

	t.Run("ignore dimensions for raw mode query", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("lb3"),
					Label: aws.String("some label"),
					Timestamps: []time.Time{
						timestamp,
					},
					Values:     []float64{23},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:  startTime,
			EndTime:    endTime,
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"*"},
			},
			Expression:       "SEARCH('MetricName=\"ResourceCount\" AND (\"AWS/Usage\") AND Resource=TargetsPer NOT QueueName=TargetsPerNetworkLoadBalancer', 'Average')",
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeRaw,
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		assert.Equal(t, "some label", frames[0].Name)
		assert.Len(t, frames[0].Fields[1].Labels, 1)
		assert.Equal(t, "some label", frames[0].Fields[1].Labels["Series"])
	})

	t.Run("Parse cloudwatch response", func(t *testing.T) {
		timestamp := time.Unix(0, 0)
		response := &models.QueryRowResponse{
			Metrics: []*cloudwatchtypes.MetricDataResult{
				{
					Id:    aws.String("id1"),
					Label: aws.String("some label"),
					Timestamps: []time.Time{
						timestamp,
						timestamp.Add(time.Minute),
						timestamp.Add(3 * time.Minute),
					},
					Values: []float64{
						10,
						20,
						30,
					},
					StatusCode: cloudwatchtypes.StatusCodeComplete,
				},
			},
		}

		query := &models.CloudWatchQuery{
			StartTime:  startTime,
			EndTime:    endTime,
			RefId:      "refId1",
			Region:     "us-east-1",
			Namespace:  "AWS/ApplicationELB",
			MetricName: "TargetResponseTime",
			Dimensions: map[string][]string{
				"LoadBalancer": {"lb"},
				"TargetGroup":  {"tg"},
			},
			Statistic:        "Average",
			Period:           60,
			MetricQueryType:  models.MetricQueryTypeSearch,
			MetricEditorMode: models.MetricEditorModeBuilder,
		}
		frames, err := buildDataFrames(contextWithFeaturesEnabled(features.FlagCloudWatchNewLabelParsing), *response, query)
		require.NoError(t, err)

		frame := frames[0]
		assert.Equal(t, "some label", frame.Name)
		assert.Equal(t, "Time", frame.Fields[0].Name)
		assert.Equal(t, "lb", frame.Fields[1].Labels["LoadBalancer"])
		assert.Equal(t, 10.0, frame.Fields[1].At(0).(float64))
		assert.Equal(t, 20.0, frame.Fields[1].At(1).(float64))
		assert.Equal(t, 30.0, frame.Fields[1].At(2).(float64))
		assert.Equal(t, "Value", frame.Fields[1].Name)
		assert.Equal(t, "", frame.Fields[1].Config.DisplayName)
	})
}
