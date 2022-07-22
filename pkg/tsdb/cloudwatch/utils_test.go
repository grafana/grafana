package cloudwatch

import (
	"context"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeCWLogsClient struct {
	cloudwatchlogsiface.CloudWatchLogsAPI

	calls logsQueryCalls

	logGroups      cloudwatchlogs.DescribeLogGroupsOutput
	logGroupFields cloudwatchlogs.GetLogGroupFieldsOutput
	queryResults   cloudwatchlogs.GetQueryResultsOutput
}

type logsQueryCalls struct {
	startQueryWithContext []*cloudwatchlogs.StartQueryInput
	getEventsWithContext  []*cloudwatchlogs.GetLogEventsInput
}

func (m *fakeCWLogsClient) GetQueryResultsWithContext(ctx context.Context, input *cloudwatchlogs.GetQueryResultsInput, option ...request.Option) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	return &m.queryResults, nil
}

func (m *fakeCWLogsClient) StartQueryWithContext(ctx context.Context, input *cloudwatchlogs.StartQueryInput, option ...request.Option) (*cloudwatchlogs.StartQueryOutput, error) {
	m.calls.startQueryWithContext = append(m.calls.startQueryWithContext, input)

	return &cloudwatchlogs.StartQueryOutput{
		QueryId: aws.String("abcd-efgh-ijkl-mnop"),
	}, nil
}

func (m *fakeCWLogsClient) StopQueryWithContext(ctx context.Context, input *cloudwatchlogs.StopQueryInput, option ...request.Option) (*cloudwatchlogs.StopQueryOutput, error) {
	return &cloudwatchlogs.StopQueryOutput{
		Success: aws.Bool(true),
	}, nil
}

func (m *fakeCWLogsClient) DescribeLogGroupsWithContext(ctx context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, option ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	return &m.logGroups, nil
}

func (m *fakeCWLogsClient) GetLogGroupFieldsWithContext(ctx context.Context, input *cloudwatchlogs.GetLogGroupFieldsInput, option ...request.Option) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	return &m.logGroupFields, nil
}

func (m *fakeCWLogsClient) GetLogEventsWithContext(ctx context.Context, input *cloudwatchlogs.GetLogEventsInput, option ...request.Option) (*cloudwatchlogs.GetLogEventsOutput, error) {
	m.calls.getEventsWithContext = append(m.calls.getEventsWithContext, input)

	return &cloudwatchlogs.GetLogEventsOutput{
		Events: []*cloudwatchlogs.OutputLogEvent{},
	}, nil
}

type fakeCWClient struct {
	cloudwatchiface.CloudWatchAPI
	cloudwatch.GetMetricDataOutput

	Metrics        []*cloudwatch.Metric
	MetricsPerPage int

	callsGetMetricDataWithContext []*cloudwatch.GetMetricDataInput
}

func (c *fakeCWClient) GetMetricDataWithContext(ctx aws.Context, input *cloudwatch.GetMetricDataInput, opts ...request.Option) (*cloudwatch.GetMetricDataOutput, error) {
	c.callsGetMetricDataWithContext = append(c.callsGetMetricDataWithContext, input)

	return &c.GetMetricDataOutput, nil
}

func (c *fakeCWClient) ListMetricsPages(input *cloudwatch.ListMetricsInput, fn func(*cloudwatch.ListMetricsOutput, bool) bool) error {
	if c.MetricsPerPage == 0 {
		c.MetricsPerPage = 1000
	}
	chunks := chunkSlice(c.Metrics, c.MetricsPerPage)

	for i, metrics := range chunks {
		response := fn(&cloudwatch.ListMetricsOutput{
			Metrics: metrics,
		}, i+1 == len(chunks))
		if !response {
			break
		}
	}
	return nil
}

type fakeCWAnnotationsClient struct {
	cloudwatchiface.CloudWatchAPI
	calls annontationsQueryCalls

	describeAlarmsForMetricOutput *cloudwatch.DescribeAlarmsForMetricOutput
	describeAlarmsOutput          *cloudwatch.DescribeAlarmsOutput
}

type annontationsQueryCalls struct {
	describeAlarmsForMetric []*cloudwatch.DescribeAlarmsForMetricInput
	describeAlarms          []*cloudwatch.DescribeAlarmsInput
}

func (c *fakeCWAnnotationsClient) DescribeAlarmsForMetric(params *cloudwatch.DescribeAlarmsForMetricInput) (*cloudwatch.DescribeAlarmsForMetricOutput, error) {
	c.calls.describeAlarmsForMetric = append(c.calls.describeAlarmsForMetric, params)

	return c.describeAlarmsForMetricOutput, nil
}

func (c *fakeCWAnnotationsClient) DescribeAlarms(params *cloudwatch.DescribeAlarmsInput) (*cloudwatch.DescribeAlarmsOutput, error) {
	c.calls.describeAlarms = append(c.calls.describeAlarms, params)

	return c.describeAlarmsOutput, nil
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

type fakeCheckHealthClient struct {
	cloudwatchiface.CloudWatchAPI
	cloudwatchlogsiface.CloudWatchLogsAPI

	listMetricsPages             func(input *cloudwatch.ListMetricsInput, fn func(*cloudwatch.ListMetricsOutput, bool) bool) error
	describeLogGroupsWithContext func(ctx aws.Context, input *cloudwatchlogs.DescribeLogGroupsInput,
		options ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error)
}

func (c fakeCheckHealthClient) ListMetricsPages(input *cloudwatch.ListMetricsInput, fn func(*cloudwatch.ListMetricsOutput, bool) bool) error {
	if c.listMetricsPages != nil {
		return c.listMetricsPages(input, fn)
	}
	return nil
}

func (c fakeCheckHealthClient) DescribeLogGroupsWithContext(ctx aws.Context, input *cloudwatchlogs.DescribeLogGroupsInput, options ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	if c.describeLogGroupsWithContext != nil {
		return c.describeLogGroupsWithContext(ctx, input, options...)
	}
	return nil, nil
}

func chunkSlice(slice []*cloudwatch.Metric, chunkSize int) [][]*cloudwatch.Metric {
	var chunks [][]*cloudwatch.Metric
	for {
		if len(slice) == 0 {
			break
		}
		if len(slice) < chunkSize {
			chunkSize = len(slice)
		}

		chunks = append(chunks, slice[0:chunkSize])
		slice = slice[chunkSize:]
	}

	return chunks
}

func newTestConfig() *setting.Cfg {
	return &setting.Cfg{AWSAllowedAuthProviders: []string{"default"}, AWSAssumeRoleEnabled: true, AWSListMetricsPageLimit: 1000}
}

type fakeSessionCache struct {
	getSession    func(c awsds.SessionConfig) (*session.Session, error)
	calledRegions []string
}

func (s *fakeSessionCache) GetSession(c awsds.SessionConfig) (*session.Session, error) {
	s.calledRegions = append(s.calledRegions, c.Settings.Region)

	if s.getSession != nil {
		return s.getSession(c)
	}
	return &session.Session{
		Config: &aws.Config{},
	}, nil
}
