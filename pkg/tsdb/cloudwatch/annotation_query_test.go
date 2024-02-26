package cloudwatch

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuery_AnnotationQuery(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var client fakeCWAnnotationsClient
	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return &client
	}

	t.Run("DescribeAlarmsForMetric is called with minimum parameters", func(t *testing.T) {
		client = fakeCWAnnotationsClient{describeAlarmsForMetricOutput: &cloudwatch.DescribeAlarmsForMetricOutput{}}
		im := defaultTestInstanceManager()

		executor := newExecutor(im, log.NewNullLogger())
		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":    "annotationQuery",
						"region":    "us-east-1",
						"namespace": "custom",
						"metricName": "CPUUtilization",
						"statistic": "Average"
					}`),
				},
			},
		})
		require.NoError(t, err)

		require.Len(t, client.calls.describeAlarmsForMetric, 1)
		assert.Equal(t, &cloudwatch.DescribeAlarmsForMetricInput{
			Namespace:  aws.String("custom"),
			MetricName: aws.String("CPUUtilization"),
			Statistic:  aws.String("Average"),
			Period:     aws.Int64(300),
		}, client.calls.describeAlarmsForMetric[0])
	})

	t.Run("DescribeAlarms is called when prefixMatching is true", func(t *testing.T) {
		client = fakeCWAnnotationsClient{describeAlarmsOutput: &cloudwatch.DescribeAlarmsOutput{}}
		im := defaultTestInstanceManager()

		executor := newExecutor(im, log.NewNullLogger())
		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":    "annotationQuery",
						"region":    "us-east-1",
						"namespace": "custom",
						"metricName": "CPUUtilization",
						"statistic": "Average",
						"prefixMatching": true,
						"actionPrefix": "some_action_prefix",
						"alarmNamePrefix": "some_alarm_name_prefix"
					}`),
				},
			},
		})
		require.NoError(t, err)

		require.Len(t, client.calls.describeAlarms, 1)
		assert.Equal(t, &cloudwatch.DescribeAlarmsInput{
			MaxRecords:      aws.Int64(100),
			ActionPrefix:    aws.String("some_action_prefix"),
			AlarmNamePrefix: aws.String("some_alarm_name_prefix"),
		}, client.calls.describeAlarms[0])
	})
}
