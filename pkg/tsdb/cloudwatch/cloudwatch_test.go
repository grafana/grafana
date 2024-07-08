package cloudwatch

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	awsclient "github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
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
			settingCtx: backend.WithGrafanaConfig(context.Background(), backend.NewGrafanaCfg(map[string]string{
				awsds.AllowedAuthProvidersEnvVarKeyName:  "foo , bar,baz",
				awsds.AssumeRoleEnabledEnvVarKeyName:     "false",
				awsds.SessionDurationEnvVarKeyName:       "10m",
				awsds.GrafanaAssumeRoleExternalIdKeyName: "mock_id",
				awsds.ListMetricsPageLimitKeyName:        "50",
				proxy.PluginSecureSocksProxyEnabled:      "true",
			})),
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
			f := NewInstanceSettings(httpclient.NewProvider())
			model, err := f(tt.settingCtx, tt.settings)
			tt.Err(t, err)
			assert.Equal(t, tt.expectedDS.Settings.GrafanaSettings, model.(DataSource).Settings.GrafanaSettings)
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
	origNewLogsAPI := NewLogsAPI

	t.Cleanup(func() {
		NewMetricsAPI = origNewMetricsAPI
		NewCWLogsClient = origNewCWLogsClient
		NewLogsAPI = origNewLogsAPI
	})

	var client fakeCheckHealthClient
	NewMetricsAPI = func(sess *session.Session) models.CloudWatchMetricsAPIProvider {
		return client
	}
	NewLogsAPI = func(sess *session.Session) models.CloudWatchLogsAPIProvider {
		return client
	}
	im := defaultTestInstanceManager()

	t.Run("successfully query metrics and logs", func(t *testing.T) {
		client = fakeCheckHealthClient{}
		executor := newExecutor(im, log.NewNullLogger())

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

		executor := newExecutor(im, log.NewNullLogger())

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

		executor := newExecutor(im, log.NewNullLogger())

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
		im := datasource.NewInstanceManager(func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{
				Settings: models.CloudWatchSettings{AWSDatasourceSettings: awsds.AWSDatasourceSettings{Region: "us-east-1"}},
				sessions: &fakeSessionCache{getSessionWithAuthSettings: func(c awsds.GetSessionConfig, a awsds.AuthSettings) (*session.Session, error) {
					return nil, fmt.Errorf("some sessions error")
				}},
			}, nil
		})

		executor := newExecutor(im, log.NewNullLogger())

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

func TestNewSession_passes_authSettings(t *testing.T) {
	ctxDuration := 15 * time.Minute
	expectedSettings := awsds.AuthSettings{
		AllowedAuthProviders:      []string{"foo", "bar", "baz"},
		AssumeRoleEnabled:         false,
		SessionDuration:           &ctxDuration,
		ExternalID:                "mock_id",
		ListMetricsPageLimit:      50,
		SecureSocksDSProxyEnabled: true,
	}
	im := datasource.NewInstanceManager((func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return DataSource{
			Settings: models.CloudWatchSettings{
				AWSDatasourceSettings: awsds.AWSDatasourceSettings{
					Region: "us-east-1",
				},
				GrafanaSettings: expectedSettings,
			},
			sessions: &fakeSessionCache{getSessionWithAuthSettings: func(c awsds.GetSessionConfig, a awsds.AuthSettings) (*session.Session, error) {
				assert.Equal(t, expectedSettings, a)
				return &session.Session{
					Config: &aws.Config{},
				}, nil
			}},
		}, nil
	}))
	executor := newExecutor(im, log.NewNullLogger())

	_, err := executor.newSessionFromContext(context.Background(),
		backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}}, "us-east-1")
	require.NoError(t, err)
}

func TestQuery_ResourceRequest_DescribeLogGroups_with_CrossAccountQuerying(t *testing.T) {
	sender := &mockedCallResourceResponseSenderForOauth{}
	origNewMetricsAPI := NewMetricsAPI
	origNewOAMAPI := NewOAMAPI
	origNewLogsAPI := NewLogsAPI
	origNewEC2Client := NewEC2Client
	NewMetricsAPI = func(sess *session.Session) models.CloudWatchMetricsAPIProvider { return nil }
	NewOAMAPI = func(sess *session.Session) models.OAMAPIProvider { return nil }
	NewEC2Client = func(provider awsclient.ConfigProvider) models.EC2APIProvider { return nil }
	t.Cleanup(func() {
		NewOAMAPI = origNewOAMAPI
		NewMetricsAPI = origNewMetricsAPI
		NewLogsAPI = origNewLogsAPI
		NewEC2Client = origNewEC2Client
	})

	var logsApi mocks.LogsAPI
	NewLogsAPI = func(sess *session.Session) models.CloudWatchLogsAPIProvider {
		return &logsApi
	}

	im := defaultTestInstanceManager()

	t.Run("maps log group api response to resource response of log-groups", func(t *testing.T) {
		logsApi = mocks.LogsAPI{}
		logsApi.On("DescribeLogGroupsWithContext", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: []*cloudwatchlogs.LogGroup{
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

		executor := newExecutor(im, log.NewNullLogger())
		err := executor.CallResource(contextWithFeaturesEnabled(features.FlagCloudWatchCrossAccountQuerying), req, sender)
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

		logsApi.AssertCalled(t, "DescribeLogGroupsWithContext",
			&cloudwatchlogs.DescribeLogGroupsInput{
				AccountIdentifiers:    []*string{utils.Pointer("some-account-id")},
				IncludeLinkedAccounts: utils.Pointer(true),
				Limit:                 utils.Pointer(int64(50)),
				LogGroupNamePrefix:    utils.Pointer("some-pattern"),
			})
	})
}
