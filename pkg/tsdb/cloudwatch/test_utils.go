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

func mockDatasource() *models.DataSource {
	jsonData := simplejson.New()
	jsonData.Set("defaultRegion", "default")
	return &models.DataSource{
		Id:             1,
		Database:       "default",
		JsonData:       jsonData,
		SecureJsonData: securejsondata.SecureJsonData{},
	}
}

type mockedCloudWatch struct {
	cloudwatchiface.CloudWatchAPI
	Resp cloudwatch.ListMetricsOutput
}

type mockedEc2 struct {
	ec2iface.EC2API
	Resp        ec2.DescribeInstancesOutput
	RespRegions ec2.DescribeRegionsOutput
}

type mockedRGTA struct {
	resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI
	Resp resourcegroupstaggingapi.GetResourcesOutput
}

type mockedLogs struct {
	cloudwatchlogsiface.CloudWatchLogsAPI
	logGroups      cloudwatchlogs.DescribeLogGroupsOutput
	logGroupFields cloudwatchlogs.GetLogGroupFieldsOutput
	queryResults   cloudwatchlogs.GetQueryResultsOutput
}

func (m mockedCloudWatch) ListMetricsPages(in *cloudwatch.ListMetricsInput, fn func(*cloudwatch.ListMetricsOutput, bool) bool) error {
	fn(&m.Resp, true)
	return nil
}

func (m mockedEc2) DescribeInstancesPages(in *ec2.DescribeInstancesInput, fn func(*ec2.DescribeInstancesOutput, bool) bool) error {
	fn(&m.Resp, true)
	return nil
}
func (m mockedEc2) DescribeRegions(in *ec2.DescribeRegionsInput) (*ec2.DescribeRegionsOutput, error) {
	return &m.RespRegions, nil
}

func (m mockedRGTA) GetResourcesPages(in *resourcegroupstaggingapi.GetResourcesInput, fn func(*resourcegroupstaggingapi.GetResourcesOutput, bool) bool) error {
	fn(&m.Resp, true)
	return nil
}

func (m mockedLogs) StartQueryWithContext(ctx context.Context, input *cloudwatchlogs.StartQueryInput, option ...request.Option) (*cloudwatchlogs.StartQueryOutput, error) {
	return &cloudwatchlogs.StartQueryOutput{
		QueryId: aws.String("abcd-efgh-ijkl-mnop"),
	}, nil
}

func (m mockedLogs) StopQueryWithContext(ctx context.Context, input *cloudwatchlogs.StopQueryInput, option ...request.Option) (*cloudwatchlogs.StopQueryOutput, error) {
	return &cloudwatchlogs.StopQueryOutput{
		Success: aws.Bool(true),
	}, nil
}

func (m mockedLogs) DescribeLogGroupsWithContext(ctx context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, option ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	return &m.logGroups, nil
}

func (m mockedLogs) GetLogGroupFieldsWithContext(ctx context.Context, input *cloudwatchlogs.GetLogGroupFieldsInput, option ...request.Option) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	return &m.logGroupFields, nil
}

// mockClients is an implementation of the clientCache interface that enables users to
// mock the AWS API by providing mock implementations of the respective APIs.
type mockClients struct {
	cloudWatch cloudwatchiface.CloudWatchAPI
	ec2        ec2iface.EC2API
	rgta       resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI
	logs       cloudwatchlogsiface.CloudWatchLogsAPI
}

func (m *mockClients) cloudWatchClient(dsInfo *DatasourceInfo) (cloudwatchiface.CloudWatchAPI, error) {
	return m.cloudWatch, nil
}

func (m *mockClients) ec2Client(dsInfo *DatasourceInfo) (ec2iface.EC2API, error) {
	return m.ec2, nil
}

func (m *mockClients) rgtaClient(dsInfo *DatasourceInfo) (resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI, error) {
	return m.rgta, nil
}

func (m *mockClients) logsClient(dsInfo *DatasourceInfo) (cloudwatchlogsiface.CloudWatchLogsAPI, error) {
	return m.logs, nil
}
