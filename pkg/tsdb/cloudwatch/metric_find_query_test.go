package cloudwatch

import (
	"encoding/json"
	"net/url"
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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuery_Metrics(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var cwClient fakeCWClient

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return &cwClient
	}

	t.Run("Custom metrics", func(t *testing.T) {
		cwClient = fakeCWClient{
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

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetMetrics(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}, url.Values{
				"region":    []string{"us-east-1"},
				"namespace": []string{"custom"},
			},
		)
		require.NoError(t, err)

		expResponse := []suggestData{
			{Text: "Test_MetricName", Value: "Test_MetricName", Label: "Test_MetricName"},
		}
		assert.Equal(t, expResponse, resp)
	})

	t.Run("Dimension keys for custom metrics", func(t *testing.T) {
		cwClient = fakeCWClient{
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

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetDimensionKeys(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}, url.Values{
				"region":    []string{"us-east-1"},
				"namespace": []string{"custom"},
			},
		)
		require.NoError(t, err)

		expResponse := []suggestData{
			{Text: "Test_DimensionName", Value: "Test_DimensionName", Label: "Test_DimensionName"},
		}
		assert.Equal(t, expResponse, resp)
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

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetRegions(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}, url.Values{
				"region":    []string{"us-east-1"},
				"namespace": []string{"custom"},
			},
		)
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

		expResponse := []suggestData{}
		for _, region := range expRegions {
			expResponse = append(expResponse, suggestData{Text: region, Value: region, Label: region})
		}
		assert.Equal(t, expResponse, resp)
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

		filterMap := map[string][]string{
			"tag:Environment": {"production"},
		}
		filterJson, err := json.Marshal(filterMap)
		require.NoError(t, err)

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetEc2InstanceAttribute(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}, url.Values{
				"region":        []string{"us-east-1"},
				"attributeName": []string{"InstanceId"},
				"filters":       []string{string(filterJson)},
			},
		)
		require.NoError(t, err)

		expResponse := []suggestData{
			{Text: instanceID, Value: instanceID, Label: instanceID},
		}
		assert.Equal(t, expResponse, resp)
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

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetEbsVolumeIds(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}, url.Values{
				"region":     []string{"us-east-1"},
				"instanceId": []string{"{i-1, i-2, i-3}"},
			},
		)
		require.NoError(t, err)

		expValues := []string{"vol-1-1", "vol-1-2", "vol-2-1", "vol-2-2", "vol-3-1", "vol-3-2"}
		expResponse := []suggestData{}
		for _, value := range expValues {
			expResponse = append(expResponse, suggestData{Text: value, Value: value, Label: value})
		}
		assert.Equal(t, expResponse, resp)
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

		tagMap := map[string][]string{
			"Environment": {"production"},
		}
		tagJson, err := json.Marshal(tagMap)
		require.NoError(t, err)

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetResourceArns(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}, url.Values{
				"region":       []string{"us-east-1"},
				"resourceType": []string{"ec2:instance"},
				"tags":         []string{string(tagJson)},
			},
		)
		require.NoError(t, err)

		expValues := []string{
			"arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567",
			"arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321",
		}
		expResponse := []suggestData{}
		for _, value := range expValues {
			expResponse = append(expResponse, suggestData{Text: value, Value: value, Label: value})
		}
		assert.Equal(t, expResponse, resp)
	})
}

func TestQuery_GetAllMetrics(t *testing.T) {
	t.Run("all metrics in all namespaces are being returned", func(t *testing.T) {
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetAllMetrics(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			url.Values{
				"region": []string{"us-east-1"},
			},
		)
		require.NoError(t, err)

		metricCount := 0
		for _, metrics := range metricsMap {
			metricCount += len(metrics)
		}

		assert.Equal(t, metricCount, len(resp))
	})
}

func TestQuery_GetDimensionKeys(t *testing.T) {
	origNewCWClient := NewCWClient
	t.Cleanup(func() {
		NewCWClient = origNewCWClient
	})

	var client fakeCWClient

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return &client
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
		client = fakeCWClient{Metrics: metrics, MetricsPerPage: 2}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetDimensionKeys(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			url.Values{
				"region":    []string{"us-east-1"},
				"namespace": []string{"AWS/EC2"},
				"dimensionFilters": []string{`{
					"InstanceId": "",
					"AutoscalingGroup": []
				}`},
			},
		)
		require.NoError(t, err)

		expValues := []string{"Dimension1", "Dimension2", "Dimension3"}
		expResponse := []suggestData{}
		for _, val := range expValues {
			expResponse = append(expResponse, suggestData{val, val, val})
		}

		assert.Equal(t, expResponse, resp)
	})

	t.Run("should return hard coded metrics when no dimension filter is specified", func(t *testing.T) {
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetDimensionKeys(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			},
			url.Values{
				"region":           []string{"us-east-1"},
				"namespace":        []string{"AWS/EC2"},
				"dimensionFilters": []string{`{}`},
			},
		)
		require.NoError(t, err)

		expValues := dimensionsMap["AWS/EC2"]
		expResponse := []suggestData{}
		for _, val := range expValues {
			expResponse = append(expResponse, suggestData{val, val, val})
		}

		assert.Equal(t, expResponse, resp)
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

	var client fakeCWClient

	NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return &client
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
		client = fakeCWClient{Metrics: metrics, MetricsPerPage: 2}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})
		executor := newExecutor(im, &setting.Cfg{AWSListMetricsPageLimit: 3, AWSAllowedAuthProviders: []string{"default"}, AWSAssumeRoleEnabled: true}, &fakeSessionCache{},
			featuremgmt.WithFeatures())
		response, err := executor.listMetrics(backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		}, "default", &cloudwatch.ListMetricsInput{})
		require.NoError(t, err)

		expectedMetrics := client.MetricsPerPage * executor.cfg.AWSListMetricsPageLimit
		assert.Equal(t, expectedMetrics, len(response))
	})

	t.Run("List Metrics and page limit is not reached", func(t *testing.T) {
		client = fakeCWClient{Metrics: metrics, MetricsPerPage: 2}
		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return datasourceInfo{}, nil
		})
		executor := newExecutor(im, &setting.Cfg{AWSListMetricsPageLimit: 1000, AWSAllowedAuthProviders: []string{"default"}, AWSAssumeRoleEnabled: true}, &fakeSessionCache{},
			featuremgmt.WithFeatures())
		response, err := executor.listMetrics(backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		}, "default", &cloudwatch.ListMetricsInput{})
		require.NoError(t, err)

		assert.Equal(t, len(metrics), len(response))
	})
}
