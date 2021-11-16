package cloudwatch

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuery_Metrics(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var cwClient FakeCWClient

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return cwClient
	}

	t.Run("Custom metrics", func(t *testing.T) {
		cwClient = FakeCWClient{
			Metrics: []*cloudwatch.Metric{
				{
					MetricName: aws.String("Test_MetricName"),
					Dimensions: []*cloudwatch.Dimension{
						{
							Name: aws.String("Test_DimensionName"),
						},
					},
				},
			},
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(nil, im, newTestConfig(), fakeSessionCache{})
		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":      "metricFindQuery",
						"subtype":   "metrics",
						"region":    "us-east-1",
						"namespace": "custom"
					}`),
				},
			},
		})
		require.NoError(t, err)

		expFrame := data.NewFrame(
			"",
			data.NewField("text", nil, []string{"Test_MetricName"}),
			data.NewField("value", nil, []string{"Test_MetricName"}),
		)
		expFrame.Meta = &data.FrameMeta{
			Custom: map[string]interface{}{
				"rowCount": 1,
			},
		}

		assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
			"": {
				Frames: data.Frames{expFrame},
			},
		},
		}, resp)
	})

	t.Run("Dimension keys for custom metrics", func(t *testing.T) {
		cwClient = FakeCWClient{
			Metrics: []*cloudwatch.Metric{
				{
					MetricName: aws.String("Test_MetricName"),
					Dimensions: []*cloudwatch.Dimension{
						{
							Name: aws.String("Test_DimensionName"),
						},
					},
				},
			},
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(nil, im, newTestConfig(), fakeSessionCache{})
		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":      "metricFindQuery",
						"subtype":   "dimension_keys",
						"region":    "us-east-1",
						"namespace": "custom"
					}`),
				},
			},
		})
		require.NoError(t, err)

		expFrame := data.NewFrame(
			"",
			data.NewField("text", nil, []string{"Test_DimensionName"}),
			data.NewField("value", nil, []string{"Test_DimensionName"}),
		)
		expFrame.Meta = &data.FrameMeta{
			Custom: map[string]interface{}{
				"rowCount": 1,
			},
		}
		assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
			"": {
				Frames: data.Frames{expFrame},
			},
		},
		}, resp)
	})
}

func TestQuery_Regions(t *testing.T) {
	origNewEC2Client := newEC2Client
	t.Cleanup(func() {
		newEC2Client = origNewEC2Client
	})

	var cli fakeEC2Client

	newEC2Client = func(client.ConfigProvider) ec2iface.EC2API {
		return cli
	}

	t.Run("An extra region", func(t *testing.T) {
		const regionName = "xtra-region"
		cli = fakeEC2Client{
			regions: []string{regionName},
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(nil, im, newTestConfig(), fakeSessionCache{})
		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":      "metricFindQuery",
						"subtype":   "regions",
						"region":    "us-east-1",
						"namespace": "custom"
					}`),
				},
			},
		})
		require.NoError(t, err)

		expRegions := append(knownRegions, regionName)
		expFrame := data.NewFrame(
			"",
			data.NewField("text", nil, expRegions),
			data.NewField("value", nil, expRegions),
		)
		expFrame.Meta = &data.FrameMeta{
			Custom: map[string]interface{}{
				"rowCount": len(knownRegions) + 1,
			},
		}

		assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
			"": {
				Frames: data.Frames{expFrame},
			},
		},
		}, resp)
	})
}

func TestQuery_InstanceAttributes(t *testing.T) {
	origNewEC2Client := newEC2Client
	t.Cleanup(func() {
		newEC2Client = origNewEC2Client
	})

	var cli fakeEC2Client

	newEC2Client = func(client.ConfigProvider) ec2iface.EC2API {
		return cli
	}

	t.Run("Get instance ID", func(t *testing.T) {
		const instanceID = "i-12345678"
		cli = fakeEC2Client{
			reservations: []*ec2.Reservation{
				{
					Instances: []*ec2.Instance{
						{
							InstanceId: aws.String(instanceID),
							Tags: []*ec2.Tag{
								{
									Key:   aws.String("Environment"),
									Value: aws.String("production"),
								},
							},
						},
					},
				},
			},
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(nil, im, newTestConfig(), fakeSessionCache{})
		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":          "metricFindQuery",
						"subtype":       "ec2_instance_attribute",
						"region":        "us-east-1",
						"attributeName": "InstanceId",
						"filters": {
							"tag:Environment": ["production"]
						}
					}`),
				},
			},
		})
		require.NoError(t, err)

		expFrame := data.NewFrame(
			"",
			data.NewField("text", nil, []string{instanceID}),
			data.NewField("value", nil, []string{instanceID}),
		)
		expFrame.Meta = &data.FrameMeta{
			Custom: map[string]interface{}{
				"rowCount": 1,
			},
		}

		assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
			"": {
				Frames: data.Frames{expFrame},
			},
		},
		}, resp)
	})
}

func TestQuery_EBSVolumeIDs(t *testing.T) {
	origNewEC2Client := newEC2Client
	t.Cleanup(func() {
		newEC2Client = origNewEC2Client
	})

	var cli fakeEC2Client

	newEC2Client = func(client.ConfigProvider) ec2iface.EC2API {
		return cli
	}

	t.Run("", func(t *testing.T) {
		cli = fakeEC2Client{
			reservations: []*ec2.Reservation{
				{
					Instances: []*ec2.Instance{
						{
							InstanceId: aws.String("i-1"),
							BlockDeviceMappings: []*ec2.InstanceBlockDeviceMapping{
								{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-1-1")}},
								{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-1-2")}},
							},
						},
						{
							InstanceId: aws.String("i-2"),
							BlockDeviceMappings: []*ec2.InstanceBlockDeviceMapping{
								{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-2-1")}},
								{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-2-2")}},
							},
						},
					},
				},
				{
					Instances: []*ec2.Instance{
						{
							InstanceId: aws.String("i-3"),
							BlockDeviceMappings: []*ec2.InstanceBlockDeviceMapping{
								{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-3-1")}},
								{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-3-2")}},
							},
						},
						{
							InstanceId: aws.String("i-4"),
							BlockDeviceMappings: []*ec2.InstanceBlockDeviceMapping{
								{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-4-1")}},
								{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-4-2")}},
							},
						},
					},
				},
			},
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(nil, im, newTestConfig(), fakeSessionCache{})
		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":       "metricFindQuery",
						"subtype":    "ebs_volume_ids",
						"region":     "us-east-1",
						"instanceId": "{i-1, i-2, i-3}"
					}`),
				},
			},
		})
		require.NoError(t, err)

		expValues := []string{"vol-1-1", "vol-1-2", "vol-2-1", "vol-2-2", "vol-3-1", "vol-3-2"}
		expFrame := data.NewFrame(
			"",
			data.NewField("text", nil, expValues),
			data.NewField("value", nil, expValues),
		)
		expFrame.Meta = &data.FrameMeta{
			Custom: map[string]interface{}{
				"rowCount": 6,
			},
		}

		assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
			"": {
				Frames: data.Frames{expFrame},
			},
		},
		}, resp)
	})
}

func TestQuery_ResourceARNs(t *testing.T) {
	origNewRGTAClient := newRGTAClient
	t.Cleanup(func() {
		newRGTAClient = origNewRGTAClient
	})

	var cli fakeRGTAClient

	newRGTAClient = func(client.ConfigProvider) resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI {
		return cli
	}

	t.Run("", func(t *testing.T) {
		cli = fakeRGTAClient{
			tagMapping: []*resourcegroupstaggingapi.ResourceTagMapping{
				{
					ResourceARN: aws.String("arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567"),
					Tags: []*resourcegroupstaggingapi.Tag{
						{
							Key:   aws.String("Environment"),
							Value: aws.String("production"),
						},
					},
				},
				{
					ResourceARN: aws.String("arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321"),
					Tags: []*resourcegroupstaggingapi.Tag{
						{
							Key:   aws.String("Environment"),
							Value: aws.String("production"),
						},
					},
				},
			},
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(nil, im, newTestConfig(), fakeSessionCache{})
		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":         "metricFindQuery",
						"subtype":      "resource_arns",
						"region":       "us-east-1",
						"resourceType": "ec2:instance",
						"tags": {
							"Environment": ["production"]
						}
					}`),
				},
			},
		})
		require.NoError(t, err)

		expValues := []string{
			"arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567",
			"arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321",
		}
		expFrame := data.NewFrame(
			"",
			data.NewField("text", nil, expValues),
			data.NewField("value", nil, expValues),
		)
		expFrame.Meta = &data.FrameMeta{
			Custom: map[string]interface{}{
				"rowCount": 2,
			},
		}

		assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
			"": {
				Frames: data.Frames{expFrame},
			},
		},
		}, resp)
	})
}

func TestQuery_GetAllMetrics(t *testing.T) {
	t.Run("all metrics in all namespaces are being returned", func(t *testing.T) {
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(nil, im, newTestConfig(), fakeSessionCache{})
		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":      "metricFindQuery",
						"subtype":   "all_metrics",
						"region":    "us-east-1"
					}`),
				},
			},
		})
		require.NoError(t, err)

		metricCount := 0
		for _, metrics := range metricsMap {
			metricCount += len(metrics)
		}

		assert.Equal(t, metricCount, resp.Responses[""].Frames[0].Fields[1].Len())
	})
}

func TestQuery_GetDimensionKeys(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var client FakeCWClient

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return client
	}

	metrics := []*cloudwatch.Metric{
		{MetricName: aws.String("Test_MetricName1"), Dimensions: []*cloudwatch.Dimension{
			{Name: aws.String("Dimension1"), Value: aws.String("Dimension1")},
			{Name: aws.String("Dimension2"), Value: aws.String("Dimension2")},
		}},
		{MetricName: aws.String("Test_MetricName2"), Dimensions: []*cloudwatch.Dimension{
			{Name: aws.String("Dimension2"), Value: aws.String("Dimension2")},
			{Name: aws.String("Dimension3"), Value: aws.String("Dimension3")},
		}},
	}

	t.Run("should fetch dimension keys from list metrics api and return unique dimensions when a dimension filter is specified", func(t *testing.T) {
		client = FakeCWClient{Metrics: metrics, MetricsPerPage: 2}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(nil, im, newTestConfig(), fakeSessionCache{})
		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":      "metricFindQuery",
						"subtype":   "dimension_keys",
						"region":    "us-east-1",
						"namespace": "AWS/EC2",
						"dimensionFilters": {
							"InstanceId": "",
							"AutoscalingGroup": []
						}
					}`),
				},
			},
		})

		require.NoError(t, err)

		expValues := []string{"Dimension1", "Dimension2", "Dimension3"}
		expFrame := data.NewFrame(
			"",
			data.NewField("text", nil, expValues),
			data.NewField("value", nil, expValues),
		)
		expFrame.Meta = &data.FrameMeta{
			Custom: map[string]interface{}{
				"rowCount": len(expValues),
			},
		}

		assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
			"": {
				Frames: data.Frames{expFrame},
			},
		},
		}, resp)
	})

	t.Run("should return hard coded metrics when no dimension filter is specified", func(t *testing.T) {
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(nil, im, newTestConfig(), fakeSessionCache{})
		resp, err := executor.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			Queries: []backend.DataQuery{
				{
					JSON: json.RawMessage(`{
						"type":      "metricFindQuery",
						"subtype":   "dimension_keys",
						"region":    "us-east-1",
						"namespace": "AWS/EC2",
						"dimensionFilters": {}
					}`),
				},
			},
		})
		require.NoError(t, err)

		expValues := dimensionsMap["AWS/EC2"]
		expFrame := data.NewFrame(
			"",
			data.NewField("text", nil, expValues),
			data.NewField("value", nil, expValues),
		)
		expFrame.Meta = &data.FrameMeta{
			Custom: map[string]interface{}{
				"rowCount": len(expValues),
			},
		}

		assert.Equal(t, &backend.QueryDataResponse{Responses: backend.Responses{
			"": {
				Frames: data.Frames{expFrame},
			},
		},
		}, resp)
	})
}
func Test_isCustomMetrics(t *testing.T) {
	metricsMap = map[string][]string{
		"AWS/EC2": {"ExampleMetric"},
	}

	type args struct {
		namespace string
	}

	tests := []struct {
		name string
		args args
		want bool
	}{
		{name: "A custom metric should return true",
			want: true,
			args: args{
				namespace: "Custom/MyApp",
			},
		},
		{name: "An AWS metric not included in this package should return true",
			want: true,
			args: args{
				namespace: "AWS/MyApp",
			},
		},
		{name: "An AWS metric included in this package should return false",
			want: false,
			args: args{
				namespace: "AWS/EC2",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isCustomMetrics(tt.args.namespace); got != tt.want {
				t.Errorf("isCustomMetrics() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestQuery_ListMetricsPagination(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var client FakeCWClient

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return client
	}

	metrics := []*cloudwatch.Metric{
		{MetricName: aws.String("Test_MetricName1")},
		{MetricName: aws.String("Test_MetricName2")},
		{MetricName: aws.String("Test_MetricName3")},
		{MetricName: aws.String("Test_MetricName4")},
		{MetricName: aws.String("Test_MetricName5")},
		{MetricName: aws.String("Test_MetricName6")},
		{MetricName: aws.String("Test_MetricName7")},
		{MetricName: aws.String("Test_MetricName8")},
		{MetricName: aws.String("Test_MetricName9")},
		{MetricName: aws.String("Test_MetricName10")},
	}

	t.Run("List Metrics and page limit is reached", func(t *testing.T) {
		client = FakeCWClient{Metrics: metrics, MetricsPerPage: 2}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})
		executor := newExecutor(nil, im, &setting.Cfg{AWSListMetricsPageLimit: 3, AWSAllowedAuthProviders: []string{"default"}, AWSAssumeRoleEnabled: true}, fakeSessionCache{})
		response, err := executor.listMetrics("default", &cloudwatch.ListMetricsInput{}, backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		})
		require.NoError(t, err)

		expectedMetrics := client.MetricsPerPage * executor.cfg.AWSListMetricsPageLimit
		assert.Equal(t, expectedMetrics, len(response))
	})

	t.Run("List Metrics and page limit is not reached", func(t *testing.T) {
		client = FakeCWClient{Metrics: metrics, MetricsPerPage: 2}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})
		executor := newExecutor(nil, im, &setting.Cfg{AWSListMetricsPageLimit: 1000, AWSAllowedAuthProviders: []string{"default"}, AWSAssumeRoleEnabled: true}, fakeSessionCache{})
		response, err := executor.listMetrics("default", &cloudwatch.ListMetricsInput{}, backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		})
		require.NoError(t, err)

		assert.Equal(t, len(metrics), len(response))
	})
}
