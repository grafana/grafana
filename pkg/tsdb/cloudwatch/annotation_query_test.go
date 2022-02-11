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
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuery_AnnotationQuery(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var client CWClientMock
	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return &client
	}

	t.Run("DescribeAlarmsForMetric is called with minimum parameters", func(t *testing.T) {
		client = CWClientMock{describeAlarmsForMetricOutput: &cloudwatch.DescribeAlarmsForMetricOutput{}}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(im, newTestConfig(), fakeSessionCache{})
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

		require.Len(t, client.calls.DescribeAlarmsForMetric, 1)
		assert.Equal(t, &cloudwatch.DescribeAlarmsForMetricInput{
			Namespace:  aws.String("custom"),
			MetricName: aws.String("CPUUtilization"),
			Statistic:  aws.String("Average"),
			Period:     aws.Int64(300),
		}, client.calls.DescribeAlarmsForMetric[0])
	})
}

type CWClientMock struct {
	cloudwatchiface.CloudWatchAPI
	calls calls

	describeAlarmsForMetricOutput *cloudwatch.DescribeAlarmsForMetricOutput
}

type calls struct {
	DescribeAlarmsForMetric []*cloudwatch.DescribeAlarmsForMetricInput
}

func (c *CWClientMock) DescribeAlarmsForMetric(params *cloudwatch.DescribeAlarmsForMetricInput) (*cloudwatch.DescribeAlarmsForMetricOutput, error) {
	c.calls.DescribeAlarmsForMetric = append(c.calls.DescribeAlarmsForMetric, params)

	return c.describeAlarmsForMetricOutput, nil
}
