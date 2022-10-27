package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewInstanceSettings(t *testing.T) {
	tests := []struct {
		name       string
		settings   backend.DataSourceInstanceSettings
		expectedDS DataSource
		Err        require.ErrorAssertionFunc
	}{
		{
			name: "creates a request",
			settings: backend.DataSourceInstanceSettings{
				JSONData: []byte(`{
					"profile": "foo",
					"defaultRegion": "us-east2",
					"assumeRoleArn": "role",
					"externalId": "id",
					"endpoint": "bar",
					"customMetricsNamespaces": "ns",
					"authType": "keys"
				}`),
				DecryptedSecureJSONData: map[string]string{
					"accessKey": "A123",
					"secretKey": "secret",
				},
			},
			expectedDS: DataSource{
				Settings: models.CloudWatchSettings{
					AWSDatasourceSettings: awsds.AWSDatasourceSettings{
						Profile:       "foo",
						Region:        "us-east2",
						AssumeRoleARN: "role",
						ExternalID:    "id",
						Endpoint:      "bar",
						AuthType:      awsds.AuthTypeKeys,
						AccessKey:     "A123",
						SecretKey:     "secret",
					},
					Namespace: "ns",
				},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := NewInstanceSettings(httpclient.NewProvider())
			model, err := f(tt.settings)
			tt.Err(t, err)
			datasourceComparer := cmp.Comparer(func(d1 DataSource, d2 DataSource) bool {
				return d1.Settings.Profile == d2.Settings.Profile &&
					d1.Settings.Region == d2.Settings.Region &&
					d1.Settings.AuthType == d2.Settings.AuthType &&
					d1.Settings.AssumeRoleARN == d2.Settings.AssumeRoleARN &&
					d1.Settings.ExternalID == d2.Settings.ExternalID &&
					d1.Settings.Namespace == d2.Settings.Namespace &&
					d1.Settings.Endpoint == d2.Settings.Endpoint &&
					d1.Settings.AccessKey == d2.Settings.AccessKey &&
					d1.Settings.SecretKey == d2.Settings.SecretKey
			})
			if !cmp.Equal(model.(DataSource), tt.expectedDS, datasourceComparer) {
				t.Errorf("Unexpected result. Expecting\n%v \nGot:\n%v", model, tt.expectedDS)
			}
		})
	}
}

func Test_CheckHealth(t *testing.T) {
	origNewMetricsAPI := NewMetricsAPI
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewMetricsAPI = origNewMetricsAPI
		NewCWLogsClient = origNewCWLogsClient
	})

	var client fakeCheckHealthClient
	NewMetricsAPI = func(sess *session.Session) models.CloudWatchMetricsAPIProvider {
		return client
	}
	NewCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
		return client
	}

	t.Run("successfully query metrics and logs", func(t *testing.T) {
		client = fakeCheckHealthClient{}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		resp, err := executor.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
		})

		assert.NoError(t, err)
		assert.Equal(t, &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: "1. Successfully queried the CloudWatch metrics API.\n2. Successfully queried the CloudWatch logs API.",
		}, resp)
	})

	t.Run("successfully queries metrics, fails during logs query", func(t *testing.T) {
		client = fakeCheckHealthClient{
			describeLogGroups: func(input *cloudwatchlogs.DescribeLogGroupsInput) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
				return nil, fmt.Errorf("some logs query error")
			}}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		resp, err := executor.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
		})

		assert.NoError(t, err)
		assert.Equal(t, &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "1. Successfully queried the CloudWatch metrics API.\n2. CloudWatch logs query failed: some logs query error",
		}, resp)
	})

	t.Run("successfully queries logs, fails during metrics query", func(t *testing.T) {
		client = fakeCheckHealthClient{
			listMetricsPages: func(input *cloudwatch.ListMetricsInput, fn func(*cloudwatch.ListMetricsOutput, bool) bool) error {
				return fmt.Errorf("some list metrics error")
			}}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		resp, err := executor.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
		})

		assert.NoError(t, err)
		assert.Equal(t, &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "1. CloudWatch metrics query failed: some list metrics error\n2. Successfully queried the CloudWatch logs API.",
		}, resp)
	})

	t.Run("fail to get clients", func(t *testing.T) {
		client = fakeCheckHealthClient{}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{getSession: func(c awsds.SessionConfig) (*session.Session, error) {
			return nil, fmt.Errorf("some sessions error")
		}}, featuremgmt.WithFeatures())

		resp, err := executor.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
		})

		assert.NoError(t, err)
		assert.Equal(t, &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "1. CloudWatch metrics query failed: some sessions error\n2. CloudWatch logs query failed: some sessions error",
		}, resp)
	})
}
func Test_executeLogAlertQuery(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var cli fakeCWLogsClient
	NewCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
		return &cli
	}

	t.Run("getCWLogsClient is called with region from input JSON", func(t *testing.T) {
		cli = fakeCWLogsClient{queryResults: cloudwatchlogs.GetQueryResultsOutput{Status: aws.String("Complete")}}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})
		sess := fakeSessionCache{}
		executor := newExecutor(im, newTestConfig(), &sess, featuremgmt.WithFeatures())

		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			Headers:       map[string]string{"FromAlert": "some value"},
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"queryMode":    "Logs",
						"region": "some region"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		assert.Equal(t, []string{"some region"}, sess.calledRegions)
	})

	t.Run("getCWLogsClient is called with region from instance manager when region is default", func(t *testing.T) {
		cli = fakeCWLogsClient{queryResults: cloudwatchlogs.GetQueryResultsOutput{Status: aws.String("Complete")}}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{AWSDatasourceSettings: awsds.AWSDatasourceSettings{Region: "instance manager's region"}}}, nil
		})
		sess := fakeSessionCache{}

		executor := newExecutor(im, newTestConfig(), &sess, featuremgmt.WithFeatures())
		_, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			Headers:       map[string]string{"FromAlert": "some value"},
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
			Queries: []backend.DataQuery{
				{
					TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(1, 0)},
					JSON: json.RawMessage(`{
						"queryMode":    "Logs",
						"region": "default"
					}`),
				},
			},
		})

		assert.NoError(t, err)
		assert.Equal(t, []string{"instance manager's region"}, sess.calledRegions)
	})
}

func TestQuery_ResourceRequest_DescribeAllLogGroups(t *testing.T) {
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewCWLogsClient = origNewCWLogsClient
	})

	var cli fakeCWLogsClient

	NewCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
		return &cli
	}

	im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return DataSource{Settings: models.CloudWatchSettings{}}, nil
	})

	executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
	sender := &mockedCallResourceResponseSenderForOauth{}

	t.Run("multiple batches", func(t *testing.T) {
		token := "foo"
		cli = fakeCWLogsClient{
			logGroups: []cloudwatchlogs.DescribeLogGroupsOutput{
				{
					LogGroups: []*cloudwatchlogs.LogGroup{
						{
							LogGroupName: aws.String("group_a"),
						},
						{
							LogGroupName: aws.String("group_b"),
						},
						{
							LogGroupName: aws.String("group_c"),
						},
					},
					NextToken: &token,
				},
				{
					LogGroups: []*cloudwatchlogs.LogGroup{
						{
							LogGroupName: aws.String("group_x"),
						},
						{
							LogGroupName: aws.String("group_y"),
						},
						{
							LogGroupName: aws.String("group_z"),
						},
					},
				},
			},
		}

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   "/all-log-groups?limit=50",
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					ID: 0,
				},
				PluginID: "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)
		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)

		suggestDataResponse := []suggestData{}
		err = json.Unmarshal(sent.Body, &suggestDataResponse)
		require.Nil(t, err)

		assert.Equal(t, stringsToSuggestData([]string{
			"group_a", "group_b", "group_c", "group_x", "group_y", "group_z",
		}), suggestDataResponse)
	})

	t.Run("Should call api with LogGroupNamePrefix if passed in resource call", func(t *testing.T) {
		cli = fakeCWLogsClient{
			logGroups: []cloudwatchlogs.DescribeLogGroupsOutput{
				{LogGroups: []*cloudwatchlogs.LogGroup{}},
			},
		}

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   "/all-log-groups?logGroupNamePrefix=test",
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					ID: 0,
				},
				PluginID: "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)

		assert.Equal(t, []*cloudwatchlogs.DescribeLogGroupsInput{
			{
				Limit:              aws.Int64(defaultLogGroupLimit),
				LogGroupNamePrefix: aws.String("test"),
			},
		}, cli.calls.describeLogGroups)
	})

	t.Run("Should call api without LogGroupNamePrefix when an empty string is passed in resource call", func(t *testing.T) {
		cli = fakeCWLogsClient{
			logGroups: []cloudwatchlogs.DescribeLogGroupsOutput{
				{LogGroups: []*cloudwatchlogs.LogGroup{}},
			},
		}

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   "/all-log-groups?logGroupNamePrefix=",
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					ID: 0,
				},
				PluginID: "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)

		assert.Equal(t, []*cloudwatchlogs.DescribeLogGroupsInput{
			{
				Limit: aws.Int64(50),
			},
		}, cli.calls.describeLogGroups)
	})
}

func TestQuery_ResourceRequest_DescribeLogGroups(t *testing.T) {
	origNewCWLogsClient := NewCWLogsClient
	t.Cleanup(func() {
		NewCWLogsClient = origNewCWLogsClient
	})

	var cli fakeCWLogsClient

	NewCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
		return &cli
	}

	im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return DataSource{Settings: models.CloudWatchSettings{}}, nil
	})

	executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
	sender := &mockedCallResourceResponseSenderForOauth{}

	t.Run("Should map log groups to SuggestData response", func(t *testing.T) {
		cli = fakeCWLogsClient{
			logGroups: []cloudwatchlogs.DescribeLogGroupsOutput{
				{LogGroups: []*cloudwatchlogs.LogGroup{
					{
						LogGroupName: aws.String("group_a"),
					},
					{
						LogGroupName: aws.String("group_b"),
					},
					{
						LogGroupName: aws.String("group_c"),
					},
				}},
			},
		}

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   "/log-groups",
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					ID: 0,
				},
				PluginID: "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)

		suggestDataResponse := []suggestData{}
		err = json.Unmarshal(sent.Body, &suggestDataResponse)
		require.Nil(t, err)

		assert.Equal(t, stringsToSuggestData([]string{"group_a", "group_b", "group_c"}), suggestDataResponse)
	})

	t.Run("Should call api with LogGroupNamePrefix if passed in resource call", func(t *testing.T) {
		cli = fakeCWLogsClient{
			logGroups: []cloudwatchlogs.DescribeLogGroupsOutput{
				{LogGroups: []*cloudwatchlogs.LogGroup{}},
			},
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   "/log-groups?logGroupNamePrefix=test",
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					ID: 0,
				},
				PluginID: "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)

		assert.Equal(t, []*cloudwatchlogs.DescribeLogGroupsInput{
			{
				Limit:              aws.Int64(defaultLogGroupLimit),
				LogGroupNamePrefix: aws.String("test"),
			},
		}, cli.calls.describeLogGroups)
	})

	t.Run("Should call api without LogGroupNamePrefix if not passed in resource call", func(t *testing.T) {
		cli = fakeCWLogsClient{
			logGroups: []cloudwatchlogs.DescribeLogGroupsOutput{
				{LogGroups: []*cloudwatchlogs.LogGroup{}},
			},
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())

		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   "/log-groups?limit=100",
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					ID: 0,
				},
				PluginID: "cloudwatch",
			},
		}
		err := executor.CallResource(context.Background(), req, sender)

		require.NoError(t, err)
		sent := sender.Response
		require.NotNil(t, sent)
		require.Equal(t, http.StatusOK, sent.Status)

		assert.Equal(t, []*cloudwatchlogs.DescribeLogGroupsInput{
			{
				Limit: aws.Int64(100),
			},
		}, cli.calls.describeLogGroups)
	})
}

func Test_CloudWatch_CallResource_Integration_Test(t *testing.T) {
	sender := &mockedCallResourceResponseSenderForOauth{}
	origNewMetricsAPI := NewMetricsAPI
	t.Cleanup(func() {
		NewMetricsAPI = origNewMetricsAPI
	})
	var api mocks.FakeMetricsAPI
	NewMetricsAPI = func(sess *session.Session) models.CloudWatchMetricsAPIProvider {
		return &api
	}

	origNewOAMAPI := NewOAMAPI
	t.Cleanup(func() {
		NewOAMAPI = origNewOAMAPI
	})
	NewOAMAPI = func(sess *session.Session) models.OAMClientProvider {
		return nil
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
		res := []string{}
		err = json.Unmarshal(sent.Body, &res)
		require.Nil(t, err)
		assert.Equal(t, []string{"Value1", "Value2", "Value7"}, res)
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
		res := []string{}
		err = json.Unmarshal(sent.Body, &res)
		require.Nil(t, err)
		assert.Equal(t, []string{"Test_DimensionName1", "Test_DimensionName2", "Test_DimensionName4", "Test_DimensionName5"}, res)
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
		res := []string{}
		err = json.Unmarshal(sent.Body, &res)
		require.Nil(t, err)
		assert.Equal(t, []string{"ClientId", "DomainName"}, res)
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
		res := []string{}
		err = json.Unmarshal(sent.Body, &res)
		require.Nil(t, err)
		assert.Equal(t, []string{"ClientId", "DomainName"}, res)
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
		res := []resources.Metric{}
		err = json.Unmarshal(sent.Body, &res)
		require.Nil(t, err)
		assert.Equal(t, []resources.Metric{{Name: "Test_MetricName1", Namespace: "AWS/EC2"}, {Name: "Test_MetricName2", Namespace: "AWS/EC2"}, {Name: "Test_MetricName3", Namespace: "AWS/ECS"}, {Name: "Test_MetricName10", Namespace: "AWS/ECS"}, {Name: "Test_MetricName4", Namespace: "AWS/ECS"}, {Name: "Test_MetricName5", Namespace: "AWS/Redshift"}}, res)
	})
}

func stringsToSuggestData(values []string) []suggestData {
	suggestDataArray := make([]suggestData, 0)
	for _, v := range values {
		suggestDataArray = append(suggestDataArray, suggestData{Text: v, Value: v, Label: v})
	}
	return suggestDataArray
}
