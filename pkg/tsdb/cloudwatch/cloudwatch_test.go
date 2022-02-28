package cloudwatch

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewInstanceSettings(t *testing.T) {
	tests := []struct {
		name       string
		settings   backend.DataSourceInstanceSettings
		expectedDS datasourceInfo
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
			expectedDS: datasourceInfo{
				profile:       "foo",
				region:        "us-east2",
				assumeRoleARN: "role",
				externalID:    "id",
				endpoint:      "bar",
				namespace:     "ns",
				authType:      awsds.AuthTypeKeys,
				accessKey:     "A123",
				secretKey:     "secret",
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := NewInstanceSettings(httpclient.NewProvider())
			model, err := f(tt.settings)
			tt.Err(t, err)
			datasourceComparer := cmp.Comparer(func(d1 datasourceInfo, d2 datasourceInfo) bool {
				return d1.profile == d2.profile &&
					d1.region == d2.region &&
					d1.authType == d2.authType &&
					d1.assumeRoleARN == d2.assumeRoleARN &&
					d1.externalID == d2.externalID &&
					d1.namespace == d2.namespace &&
					d1.endpoint == d2.endpoint &&
					d1.accessKey == d2.accessKey &&
					d1.secretKey == d2.secretKey &&
					d1.datasourceID == d2.datasourceID
			})
			if !cmp.Equal(model.(datasourceInfo), tt.expectedDS, datasourceComparer) {
				t.Errorf("Unexpected result. Expecting\n%v \nGot:\n%v", model, tt.expectedDS)
			}
		})
	}
}

func Test_CheckHealth(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var client FakeCWClient

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return client
	}

	metrics := []*cloudwatch.Metric{
		{MetricName: aws.String("EstimatedCharges"), Dimensions: []*cloudwatch.Dimension{
			{Name: aws.String("Dimension1"), Value: aws.String("Dimension1")},
			{Name: aws.String("Dimension2"), Value: aws.String("Dimension2")},
		}},
	}

	client = FakeCWClient{Metrics: metrics, MetricsPerPage: 2}
	im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return datasourceInfo{}, nil
	})

	executor := newExecutor(im, newTestConfig(), fakeSessionCache{})
	request := &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		},
	}
	resp, err := executor.CheckHealth(context.Background(), request)
	require.NoError(t, err)

	expResponse := &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Successfully queried the CloudWatch API.",
	}

	assert.Equal(t, expResponse, resp)
}
