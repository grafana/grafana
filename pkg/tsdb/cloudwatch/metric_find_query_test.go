package cloudwatch

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuery_Metrics(t *testing.T) {
	origNewCWClient := newCWClient
	t.Cleanup(func() {
		newCWClient = origNewCWClient
	})

	var client fakeCWClient

	newCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return client
	}

	t.Run("Custom metrics", func(t *testing.T) {
		client = fakeCWClient{
			metrics: []*cloudwatch.Metric{
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
		executor := &CloudWatchExecutor{}
		resp, err := executor.Query(context.Background(), fakeDataSource(), &tsdb.TsdbQuery{
			Queries: []*tsdb.Query{
				{
					Model: simplejson.NewFromAny(map[string]interface{}{
						"type":      "metricFindQuery",
						"subtype":   "metrics",
						"region":    "us-east-1",
						"namespace": "custom",
					}),
				},
			},
		})
		require.NoError(t, err)

		assert.Equal(t, &tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				"": {
					Meta: simplejson.NewFromAny(map[string]interface{}{
						"rowCount": 1,
					}),
					Tables: []*tsdb.Table{
						{
							Columns: []tsdb.TableColumn{
								{
									Text: "text",
								},
								{
									Text: "value",
								},
							},
							Rows: []tsdb.RowValues{
								{
									"Test_MetricName",
									"Test_MetricName",
								},
							},
						},
					},
				},
			},
		}, resp)
	})

	t.Run("Dimension keys for custom metrics", func(t *testing.T) {
		client = fakeCWClient{
			metrics: []*cloudwatch.Metric{
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
		executor := &CloudWatchExecutor{}
		resp, err := executor.Query(context.Background(), fakeDataSource(), &tsdb.TsdbQuery{
			Queries: []*tsdb.Query{
				{
					Model: simplejson.NewFromAny(map[string]interface{}{
						"type":      "metricFindQuery",
						"subtype":   "dimension_keys",
						"region":    "us-east-1",
						"namespace": "custom",
					}),
				},
			},
		})
		require.NoError(t, err)

		assert.Equal(t, &tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				"": {
					Meta: simplejson.NewFromAny(map[string]interface{}{
						"rowCount": 1,
					}),
					Tables: []*tsdb.Table{
						{
							Columns: []tsdb.TableColumn{
								{
									Text: "text",
								},
								{
									Text: "value",
								},
							},
							Rows: []tsdb.RowValues{
								{
									"Test_DimensionName",
									"Test_DimensionName",
								},
							},
						},
					},
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
		executor := &CloudWatchExecutor{}
		resp, err := executor.Query(context.Background(), fakeDataSource(), &tsdb.TsdbQuery{
			Queries: []*tsdb.Query{
				{
					Model: simplejson.NewFromAny(map[string]interface{}{
						"type":      "metricFindQuery",
						"subtype":   "regions",
						"region":    "us-east-1",
						"namespace": "custom",
					}),
				},
			},
		})
		require.NoError(t, err)

		rows := []tsdb.RowValues{}
		for _, region := range knownRegions {
			rows = append(rows, []interface{}{
				region,
				region,
			})
		}
		rows = append(rows, []interface{}{
			"xtra-region",
			"xtra-region",
		})
		assert.Equal(t, &tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				"": {
					Meta: simplejson.NewFromAny(map[string]interface{}{
						"rowCount": len(knownRegions) + 1,
					}),
					Tables: []*tsdb.Table{
						{
							Columns: []tsdb.TableColumn{
								{
									Text: "text",
								},
								{
									Text: "value",
								},
							},
							Rows: rows,
						},
					},
				},
			},
		}, resp)
	})
}

/*
	t.Run("When calling handleGetRegions", func(t *testing.T) {
		executor := &CloudWatchExecutor{
			clients: &mockClients{
				ec2: mockedEc2{RespRegions: ec2.DescribeRegionsOutput{
					Regions: []*ec2.Region{
						{
							RegionName: aws.String("ap-northeast-2"),
						},
					},
				},
				}},
		}
		jsonData := simplejson.New()
		jsonData.Set("defaultRegion", "default")
		executor.DataSource = &models.DataSource{
			JsonData:       jsonData,
			SecureJsonData: securejsondata.SecureJsonData{},
		}

		result, err := executor.handleGetRegions(context.Background(), simplejson.New(), &tsdb.TsdbQuery{})
		require.NoError(t, err)

		assert.Equal(t, "ap-east-1", result[0].Text)
		assert.Equal(t, "ap-northeast-1", result[1].Text)
		assert.Equal(t, "ap-northeast-2", result[2].Text)
	})

	t.Run("When calling handleGetEc2InstanceAttribute", func(t *testing.T) {
		executor := &CloudWatchExecutor{
			DataSource: mockDatasource(),
			clients: &mockClients{
				ec2: mockedEc2{Resp: ec2.DescribeInstancesOutput{
					Reservations: []*ec2.Reservation{
						{
							Instances: []*ec2.Instance{
								{
									InstanceId: aws.String("i-12345678"),
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
				},
				}},
		}

		json := simplejson.New()
		json.Set("region", "us-east-1")
		json.Set("attributeName", "InstanceId")
		filters := make(map[string]interface{})
		filters["tag:Environment"] = []string{"production"}
		json.Set("filters", filters)
		result, err := executor.handleGetEc2InstanceAttribute(context.Background(), json, &tsdb.TsdbQuery{})
		require.NoError(t, err)

		assert.Equal(t, "i-12345678", result[0].Text)
	})

	t.Run("When calling handleGetEbsVolumeIds", func(t *testing.T) {
		executor := &CloudWatchExecutor{
			DataSource: mockDatasource(),
			clients: &mockClients{
				ec2: mockedEc2{Resp: ec2.DescribeInstancesOutput{
					Reservations: []*ec2.Reservation{
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
				},
				}},
		}

		json := simplejson.New()
		json.Set("region", "us-east-1")
		json.Set("instanceId", "{i-1, i-2, i-3, i-4}")
		result, err := executor.handleGetEbsVolumeIds(context.Background(), json, &tsdb.TsdbQuery{})
		require.NoError(t, err)

		require.Len(t, result, 8)
		assert.Equal(t, "vol-1-1", result[0].Text)
		assert.Equal(t, "vol-1-2", result[1].Text)
		assert.Equal(t, "vol-2-1", result[2].Text)
		assert.Equal(t, "vol-2-2", result[3].Text)
		assert.Equal(t, "vol-3-1", result[4].Text)
		assert.Equal(t, "vol-3-2", result[5].Text)
		assert.Equal(t, "vol-4-1", result[6].Text)
		assert.Equal(t, "vol-4-2", result[7].Text)
	})

	t.Run("When calling handleGetResourceArns", func(t *testing.T) {
		executor := &CloudWatchExecutor{
			DataSource: mockDatasource(),
			clients: &mockClients{
				rgta: mockedRGTA{
					Resp: resourcegroupstaggingapi.GetResourcesOutput{
						ResourceTagMappingList: []*resourcegroupstaggingapi.ResourceTagMapping{
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
					},
				},
			},
		}

		json := simplejson.New()
		json.Set("region", "us-east-1")
		json.Set("resourceType", "ec2:instance")
		tags := make(map[string]interface{})
		tags["Environment"] = []string{"production"}
		json.Set("tags", tags)
		result, err := executor.handleGetResourceArns(context.Background(), json, &tsdb.TsdbQuery{})
		require.NoError(t, err)

		assert.Equal(t, "arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567", result[0].Text)
		assert.Equal(t, "arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567", result[0].Value)
		assert.Equal(t, "arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321", result[1].Text)
		assert.Equal(t, "arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321", result[1].Value)
	})
}

func TestParseMultiSelectValue(t *testing.T) {
	values := parseMultiSelectValue(" i-someInstance ")
	assert.Equal(t, []string{"i-someInstance"}, values)

	values = parseMultiSelectValue("{i-05}")
	assert.Equal(t, []string{"i-05"}, values)

	values = parseMultiSelectValue(" {i-01, i-03, i-04} ")
	assert.Equal(t, []string{"i-01", "i-03", "i-04"}, values)

	values = parseMultiSelectValue("i-{01}")
	assert.Equal(t, []string{"i-{01}"}, values)
}
*/
