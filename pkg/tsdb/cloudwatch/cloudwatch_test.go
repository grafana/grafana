package cloudwatch

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	cloudwatchlogstypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-aws-sdk/pkg/awsauth"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestNewInstanceSettings(t *testing.T) {
	ctxDuration := 10 * time.Minute
	tests := []struct {
		name       string
		settings   backend.DataSourceInstanceSettings
		settingCtx context.Context
		expectedDS *DataSource
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
			settingCtx: backend.WithGrafanaConfig(context.Background(), backend.NewGrafanaCfg(map[string]string{
				awsds.AllowedAuthProvidersEnvVarKeyName:  "foo , bar,baz",
				awsds.AssumeRoleEnabledEnvVarKeyName:     "false",
				awsds.SessionDurationEnvVarKeyName:       "10m",
				awsds.GrafanaAssumeRoleExternalIdKeyName: "mock_id",
				awsds.ListMetricsPageLimitKeyName:        "50",
				proxy.PluginSecureSocksProxyEnabled:      "true",
			})),
			expectedDS: &DataSource{
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
					GrafanaSettings: awsds.AuthSettings{
						AllowedAuthProviders:      []string{"foo", "bar", "baz"},
						AssumeRoleEnabled:         false,
						SessionDuration:           &ctxDuration,
						ExternalID:                "mock_id",
						ListMetricsPageLimit:      50,
						SecureSocksDSProxyEnabled: true,
					},
				},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			instance, err := NewDatasource(tt.settingCtx, tt.settings)
			ds := instance.(*DataSource)
			tt.Err(t, err)
			assert.Equal(t, tt.expectedDS.Settings.GrafanaSettings, ds.Settings.GrafanaSettings)
			datasourceComparer := cmp.Comparer(func(d1 *DataSource, d2 *DataSource) bool {
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
			if !cmp.Equal(instance.(*DataSource), tt.expectedDS, datasourceComparer) {
				t.Errorf("Unexpected result. Expecting\n%v \nGot:\n%v", instance, tt.expectedDS)
			}
		})
	}
}

func Test_CheckHealth(t *testing.T) {
	origNewCWClient := NewCWClient
	origNewCWLogsClient := NewCWLogsClient
	origNewLogsAPI := NewLogsAPI

	t.Cleanup(func() {
		NewCWClient = origNewCWClient
		NewCWLogsClient = origNewCWLogsClient
		NewLogsAPI = origNewLogsAPI
	})

	var client fakeCheckHealthClient
	NewCWClient = func(aws.Config) models.CWClient {
		return client
	}
	NewLogsAPI = func(aws.Config) models.CloudWatchLogsAPIProvider {
		return client
	}

	t.Run("successfully query metrics and logs", func(t *testing.T) {
		client = fakeCheckHealthClient{}
		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.Region = "us-east-1"
		})
		resp, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}}})

		assert.NoError(t, err)
		assert.Equal(t, &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: "1. Successfully queried the CloudWatch metrics API.\n2. Successfully queried the CloudWatch logs API.",
		}, resp)
	})

	t.Run("successfully queries metrics, fails during logs query", func(t *testing.T) {
		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.Region = "us-east-1"
		})
		client = fakeCheckHealthClient{
			describeLogGroupsFunction: func(context.Context, *cloudwatchlogs.DescribeLogGroupsInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
				return nil, fmt.Errorf("some logs query error")
			},
		}
		resp, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
		})

		assert.NoError(t, err)
		assert.Equal(t, &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "1. Successfully queried the CloudWatch metrics API.\n2. CloudWatch logs query failed: some logs query error",
		}, resp)
	})

	t.Run("successfully queries logs, fails during metrics query", func(t *testing.T) {
		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.Region = "us-east-1"
			ds.Settings.GrafanaSettings.ListMetricsPageLimit = 1
		})
		client = fakeCheckHealthClient{
			listMetricsFunction: func(context.Context, *cloudwatch.ListMetricsInput, ...func(*cloudwatch.Options)) (*cloudwatch.ListMetricsOutput, error) {
				return nil, fmt.Errorf("some list metrics error")
			}}
		resp, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{
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
		ds := newTestDatasource(func(ds *DataSource) {
			ds.AWSConfigProvider = awsauth.NewFakeConfigProvider(true)
			ds.Settings.Region = "us-east-1"
		})
		resp, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}},
		})

		assert.NoError(t, err)
		assert.Equal(t, &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "1. CloudWatch metrics query failed: LoadDefaultConfig failed\n2. CloudWatch logs query failed: LoadDefaultConfig failed",
		}, resp)
	})
}

func TestGetAWSConfig_passes_authSettings(t *testing.T) {
	// TODO: update this for the new auth structure, or remove it
	t.Skip()
	ctxDuration := 15 * time.Minute
	expectedSettings := awsds.AuthSettings{
		AllowedAuthProviders:      []string{"foo", "bar", "baz"},
		AssumeRoleEnabled:         false,
		SessionDuration:           &ctxDuration,
		ExternalID:                "mock_id",
		ListMetricsPageLimit:      50,
		SecureSocksDSProxyEnabled: true,
	}
	ds := newTestDatasource(func(ds *DataSource) {
		ds.Settings.Region = "us-east-1"
		ds.Settings.GrafanaSettings = expectedSettings
	})

	_, err := ds.getAWSConfig(context.Background(), "us-east-1")
	require.NoError(t, err)
}

func TestQuery_ResourceRequest_DescribeLogGroups_with_CrossAccountQuerying(t *testing.T) {
	sender := &mockedCallResourceResponseSenderForOauth{}
	origNewMetricsAPI := NewCWClient
	origNewOAMAPI := NewOAMAPI
	origNewLogsAPI := NewLogsAPI
	origNewEC2API := NewEC2API
	NewCWClient = func(aws.Config) models.CWClient { return nil }
	NewOAMAPI = func(aws.Config) models.OAMAPIProvider { return nil }
	NewEC2API = func(aws.Config) models.EC2APIProvider { return nil }
	t.Cleanup(func() {
		NewOAMAPI = origNewOAMAPI
		NewCWClient = origNewMetricsAPI
		NewLogsAPI = origNewLogsAPI
		NewEC2API = origNewEC2API
	})

	var logsApi mocks.LogsAPI
	NewLogsAPI = func(aws.Config) models.CloudWatchLogsAPIProvider {
		return &logsApi
	}

	t.Run("maps log group api response to resource response of log-groups", func(t *testing.T) {
		logsApi = mocks.LogsAPI{}
		logsApi.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: []cloudwatchlogstypes.LogGroup{
				{Arn: aws.String("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: aws.String("group_a")},
			},
		}, nil)
		req := &backend.CallResourceRequest{
			Method: "GET",
			Path:   `/log-groups?logGroupPattern=some-pattern&accountId=some-account-id`,
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{ID: 0},
				PluginID:                   "cloudwatch",
			},
		}

		ds := newTestDatasource()

		err := ds.CallResource(contextWithFeaturesEnabled(features.FlagCloudWatchCrossAccountQuerying), req, sender)
		assert.NoError(t, err)

		assert.JSONEq(t, `[
		   {
			  "accountId":"111",
			  "value":{
				 "arn":"arn:aws:logs:us-east-1:111:log-group:group_a",
				 "name":"group_a"
			  }
		   }
		]`, string(sender.Response.Body))

		logsApi.AssertCalled(t, "DescribeLogGroups",
			&cloudwatchlogs.DescribeLogGroupsInput{
				AccountIdentifiers:    []string{"some-account-id"},
				IncludeLinkedAccounts: utils.Pointer(true),
				Limit:                 aws.Int32(50),
				LogGroupNamePrefix:    utils.Pointer("some-pattern"),
			})
	})
}
