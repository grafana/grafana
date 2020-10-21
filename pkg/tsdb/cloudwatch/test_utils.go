package cloudwatch

import (
	"context"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

type fakeDataSourceCfg struct {
	assumeRoleARN string
	externalID    string
}

func fakeDataSource(cfgs ...fakeDataSourceCfg) *models.DataSource {
	jsonData := simplejson.New()
	jsonData.Set("defaultRegion", defaultRegion)
	jsonData.Set("authType", "default")
	for _, cfg := range cfgs {
		if cfg.assumeRoleARN != "" {
			jsonData.Set("assumeRoleArn", cfg.assumeRoleARN)
		}
		if cfg.externalID != "" {
			jsonData.Set("externalId", cfg.externalID)
		}
	}
	return &models.DataSource{
		Id:             1,
		Database:       "default",
		JsonData:       jsonData,
		SecureJsonData: securejsondata.SecureJsonData{},
	}
}

type fakeCWLogsClient struct {
	cloudwatchlogsiface.CloudWatchLogsAPI
	logGroups      cloudwatchlogs.DescribeLogGroupsOutput
	logGroupFields cloudwatchlogs.GetLogGroupFieldsOutput
	queryResults   cloudwatchlogs.GetQueryResultsOutput
}

func (m fakeCWLogsClient) GetQueryResultsWithContext(ctx context.Context, input *cloudwatchlogs.GetQueryResultsInput, option ...request.Option) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	return &m.queryResults, nil
}

func (m fakeCWLogsClient) StartQueryWithContext(ctx context.Context, input *cloudwatchlogs.StartQueryInput, option ...request.Option) (*cloudwatchlogs.StartQueryOutput, error) {
	return &cloudwatchlogs.StartQueryOutput{
		QueryId: aws.String("abcd-efgh-ijkl-mnop"),
	}, nil
}

func (m fakeCWLogsClient) StopQueryWithContext(ctx context.Context, input *cloudwatchlogs.StopQueryInput, option ...request.Option) (*cloudwatchlogs.StopQueryOutput, error) {
	return &cloudwatchlogs.StopQueryOutput{
		Success: aws.Bool(true),
	}, nil
}

func (m fakeCWLogsClient) DescribeLogGroupsWithContext(ctx context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, option ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	return &m.logGroups, nil
}

func (m fakeCWLogsClient) GetLogGroupFieldsWithContext(ctx context.Context, input *cloudwatchlogs.GetLogGroupFieldsInput, option ...request.Option) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	return &m.logGroupFields, nil
}

type fakeCWClient struct {
	cloudwatchiface.CloudWatchAPI

	metrics []*cloudwatch.Metric
}

func (c fakeCWClient) ListMetricsPages(input *cloudwatch.ListMetricsInput, fn func(*cloudwatch.ListMetricsOutput, bool) bool) error {
	fn(&cloudwatch.ListMetricsOutput{
		Metrics: c.metrics,
	}, true)
	return nil
}

type fakeEC2Client struct {
	ec2iface.EC2API

	regions      []string
	reservations []*ec2.Reservation
}

func (c fakeEC2Client) DescribeRegions(*ec2.DescribeRegionsInput) (*ec2.DescribeRegionsOutput, error) {
	regions := []*ec2.Region{}
	for _, region := range c.regions {
		regions = append(regions, &ec2.Region{
			RegionName: aws.String(region),
		})
	}
	return &ec2.DescribeRegionsOutput{
		Regions: regions,
	}, nil
}

func (c fakeEC2Client) DescribeInstancesPages(in *ec2.DescribeInstancesInput,
	fn func(*ec2.DescribeInstancesOutput, bool) bool) error {
	reservations := []*ec2.Reservation{}
	for _, r := range c.reservations {
		instances := []*ec2.Instance{}
		for _, inst := range r.Instances {
			if len(in.InstanceIds) == 0 {
				instances = append(instances, inst)
				continue
			}

			for _, id := range in.InstanceIds {
				if *inst.InstanceId == *id {
					instances = append(instances, inst)
				}
			}
		}
		reservation := &ec2.Reservation{Instances: instances}
		reservations = append(reservations, reservation)
	}
	fn(&ec2.DescribeInstancesOutput{
		Reservations: reservations,
	}, true)
	return nil
}

type fakeRGTAClient struct {
	resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI

	tagMapping []*resourcegroupstaggingapi.ResourceTagMapping
}

func (c fakeRGTAClient) GetResourcesPages(in *resourcegroupstaggingapi.GetResourcesInput,
	fn func(*resourcegroupstaggingapi.GetResourcesOutput, bool) bool) error {
	fn(&resourcegroupstaggingapi.GetResourcesOutput{
		ResourceTagMappingList: c.tagMapping,
	}, true)
	return nil
}
