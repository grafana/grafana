package cloudwatch

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func Test_CloudWatch_CallResource_Integration_Test(t *testing.T) {
	sender := &mockedCallResourceResponseSenderForOauth{}
	origNewMetricsAPI := NewMetricsAPI
	origNewOAMAPI := NewOAMAPI
	origNewLogsAPI := NewLogsAPI
	NewOAMAPI = func(sess *session.Session) models.OAMAPIProvider { return nil }

	var logApi mocks.LogsAPI
	NewLogsAPI = func(sess *session.Session) models.CloudWatchLogsAPIProvider {
		return &logApi
	}

	t.Cleanup(func() {
		NewOAMAPI = origNewOAMAPI
		NewMetricsAPI = origNewMetricsAPI
		NewLogsAPI = origNewLogsAPI
	})

	var api mocks.FakeMetricsAPI
	NewMetricsAPI = func(sess *session.Session) models.CloudWatchMetricsAPIProvider {
		return &api
	}

	im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return DataSource{Settings: models.CloudWatchSettings{}}, nil
	})

	t.Run("Should handle dimension value request and return values from the api", func(t *testing.T) {
		pageLimit := 100
		api = mocks.FakeMetricsAPI{Metrics: []*cloudwatch.Metric{
			{MetricName: aws.String("Test_MetricName1"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1"), Value: aws.String("Value1")}, {Name: aws.String("Test_DimensionName2"), Value: aws.String("Value2")}}},
			{MetricName: aws.String("Test_MetricName2"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1"), Value: aws.String("Value3")}}},
			{MetricName: aws.String("Test_MetricName3"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName2"), Value: aws.String("Value1")}}},
			{MetricName: aws.String("Test_MetricName10"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName4"), Value: aws.String("Value2")}, {Name: aws.String("Test_DimensionName5")}}},
			{MetricName: aws.String("Test_MetricName4"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName2"), Value: aws.String("Value3")}}},
			{MetricName: aws.String("Test_MetricName5"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1"), Value: aws.String("Value4")}}},
			{MetricName: aws.String("Test_MetricName6"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1"), Value: aws.String("Value6")}}},
			{MetricName: aws.String("Test_MetricName7"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName4"), Value: aws.String("Value7")}}},
			{MetricName: aws.String("Test_MetricName8"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName4"), Value: aws.String("Value1")}}},
			{MetricName: aws.String("Test_MetricName9"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1"), Value: aws.String("Value2")}}},
		}, MetricsPerPage: 100}
		executor := newExecutor(im, &setting.Cfg{AWSListMetricsPageLimit: pageLimit}, &fakeSessionCache{}, featuremgmt.WithFeatures())

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   `/dimension-values?region=us-east-2&dimensionKey=Test_DimensionName4&namespace=AWS/EC2&metricName=CPUUtilization`,
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{ID: 0},
				PluginID:                   "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)
		res := []resources.ResourceResponse[string]{}
		err = json.Unmarshal(sent.Body, &res)
		require.Nil(t, err)
		assert.Equal(t, []resources.ResourceResponse[string]{{Value: "Value1"}, {Value: "Value2"}, {Value: "Value7"}}, res)
	})

	t.Run("Should handle dimension key filter query and return keys from the api", func(t *testing.T) {
		pageLimit := 3
		api = mocks.FakeMetricsAPI{Metrics: []*cloudwatch.Metric{
			{MetricName: aws.String("Test_MetricName1"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1")}, {Name: aws.String("Test_DimensionName2")}}},
			{MetricName: aws.String("Test_MetricName2"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1")}}},
			{MetricName: aws.String("Test_MetricName3"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName2")}}},
			{MetricName: aws.String("Test_MetricName10"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName4")}, {Name: aws.String("Test_DimensionName5")}}},
			{MetricName: aws.String("Test_MetricName4"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName2")}}},
			{MetricName: aws.String("Test_MetricName5"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1")}}},
			{MetricName: aws.String("Test_MetricName6"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1")}}},
			{MetricName: aws.String("Test_MetricName7"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName4")}}},
			{MetricName: aws.String("Test_MetricName8"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName4")}}},
			{MetricName: aws.String("Test_MetricName9"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1")}}},
		}, MetricsPerPage: 2}
		executor := newExecutor(im, &setting.Cfg{AWSListMetricsPageLimit: pageLimit}, &fakeSessionCache{}, featuremgmt.WithFeatures())

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   `/dimension-keys?region=us-east-2&namespace=AWS/EC2&metricName=CPUUtilization&dimensionFilters={"NodeID":["Shared"],"stage":["QueryCommit"]}`,
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{ID: 0},
				PluginID:                   "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)
		res := []resources.ResourceResponse[string]{}
		err = json.Unmarshal(sent.Body, &res)
		require.Nil(t, err)
		assert.Equal(t, []resources.ResourceResponse[string]{{Value: "Test_DimensionName1"}, {Value: "Test_DimensionName2"}, {Value: "Test_DimensionName4"}, {Value: "Test_DimensionName5"}}, res)
	})

	t.Run("Should handle standard dimension key query and return hard coded keys", func(t *testing.T) {
		api = mocks.FakeMetricsAPI{}
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   `/dimension-keys?region=us-east-2&namespace=AWS/CloudSearch&metricName=CPUUtilization`,
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{ID: 0},
				PluginID:                   "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)
		res := []resources.ResourceResponse[string]{}
		err = json.Unmarshal(sent.Body, &res)
		require.Nil(t, err)
		assert.Equal(t, []resources.ResourceResponse[string]{{Value: "ClientId"}, {Value: "DomainName"}}, res)
	})

	t.Run("Should handle custom namespace dimension key query and return hard coded keys", func(t *testing.T) {
		api = mocks.FakeMetricsAPI{}
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   `/dimension-keys?region=us-east-2&namespace=AWS/CloudSearch&metricName=CPUUtilization`,
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{ID: 0},
				PluginID:                   "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)
		res := []resources.ResourceResponse[string]{}
		err = json.Unmarshal(sent.Body, &res)
		require.Nil(t, err)
		assert.Equal(t, []resources.ResourceResponse[string]{{Value: "ClientId"}, {Value: "DomainName"}}, res)
	})

	t.Run("Should handle custom namespace metrics query and return metrics from api", func(t *testing.T) {
		pageLimit := 3
		api = mocks.FakeMetricsAPI{Metrics: []*cloudwatch.Metric{
			{MetricName: aws.String("Test_MetricName1"), Namespace: aws.String("AWS/EC2"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1")}, {Name: aws.String("Test_DimensionName2")}}},
			{MetricName: aws.String("Test_MetricName2"), Namespace: aws.String("AWS/EC2"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1")}}},
			{MetricName: aws.String("Test_MetricName3"), Namespace: aws.String("AWS/ECS"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName2")}}},
			{MetricName: aws.String("Test_MetricName10"), Namespace: aws.String("AWS/ECS"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName4")}, {Name: aws.String("Test_DimensionName5")}}},
			{MetricName: aws.String("Test_MetricName4"), Namespace: aws.String("AWS/ECS"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName2")}}},
			{MetricName: aws.String("Test_MetricName5"), Namespace: aws.String("AWS/Redshift"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1")}}},
			{MetricName: aws.String("Test_MetricName6"), Namespace: aws.String("AWS/Redshift"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1")}}},
			{MetricName: aws.String("Test_MetricName7"), Namespace: aws.String("AWS/EC2"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName4")}}},
			{MetricName: aws.String("Test_MetricName8"), Namespace: aws.String("AWS/EC2"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName4")}}},
			{MetricName: aws.String("Test_MetricName9"), Namespace: aws.String("AWS/EC2"), Dimensions: []*cloudwatch.Dimension{{Name: aws.String("Test_DimensionName1")}}},
		}, MetricsPerPage: 2}
		executor := newExecutor(im, &setting.Cfg{AWSListMetricsPageLimit: pageLimit}, &fakeSessionCache{}, featuremgmt.WithFeatures())

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   `/metrics?region=us-east-2&namespace=custom-namespace`,
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{ID: 0},
				PluginID:                   "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)
		res := []resources.ResourceResponse[resources.Metric]{}
		err = json.Unmarshal(sent.Body, &res)
		require.Nil(t, err)
		assert.Equal(t, []resources.ResourceResponse[resources.Metric]{{Value: resources.Metric{Name: "Test_MetricName1", Namespace: "AWS/EC2"}}, {Value: resources.Metric{Name: "Test_MetricName2", Namespace: "AWS/EC2"}}, {Value: resources.Metric{Name: "Test_MetricName3", Namespace: "AWS/ECS"}}, {Value: resources.Metric{Name: "Test_MetricName10", Namespace: "AWS/ECS"}}, {Value: resources.Metric{Name: "Test_MetricName4", Namespace: "AWS/ECS"}}, {Value: resources.Metric{Name: "Test_MetricName5", Namespace: "AWS/Redshift"}}}, res)
	})

	t.Run("Should handle log group fields request", func(t *testing.T) {
		logApi = mocks.LogsAPI{}
		logApi.On("GetLogGroupFields", mock.Anything).Return(&cloudwatchlogs.GetLogGroupFieldsOutput{
			LogGroupFields: []*cloudwatchlogs.LogGroupField{
				{
					Name:    aws.String("field1"),
					Percent: aws.Int64(50),
				},
				{
					Name:    aws.String("field2"),
					Percent: aws.Int64(50),
				},
			},
		}, nil)
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   `/log-group-fields?region=us-east-2&logGroupName=test`,
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{ID: 0},
				PluginID:                   "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)
		require.Nil(t, err)
		assert.JSONEq(t, `[{"value":{"name":"field1","percent":50}},{"value":{"name":"field2","percent":50}}]`, string(sent.Body))
	})
}
