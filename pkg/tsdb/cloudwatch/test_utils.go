package cloudwatch

import (
	"context"
	"strings"

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
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/patrickmn/go-cache"
	"github.com/stretchr/testify/mock"
)

type fakeCWLogsClient struct {
	cloudwatchlogsiface.CloudWatchLogsAPI

	calls logsQueryCalls

	logGroups      []cloudwatchlogs.DescribeLogGroupsOutput
	logGroupFields cloudwatchlogs.GetLogGroupFieldsOutput
	queryResults   cloudwatchlogs.GetQueryResultsOutput

	logGroupsIndex int
}

type logsQueryCalls struct {
	startQueryWithContext []*cloudwatchlogs.StartQueryInput
	getEventsWithContext  []*cloudwatchlogs.GetLogEventsInput
	describeLogGroups     []*cloudwatchlogs.DescribeLogGroupsInput
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

type mockLogsSyncClient struct {
	cloudwatchlogsiface.CloudWatchLogsAPI

	mock.Mock
}

func (m *mockLogsSyncClient) GetQueryResultsWithContext(ctx context.Context, input *cloudwatchlogs.GetQueryResultsInput, option ...request.Option) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	args := m.Called(ctx, input, option)
	return args.Get(0).(*cloudwatchlogs.GetQueryResultsOutput), args.Error(1)
}
func (m *mockLogsSyncClient) StartQueryWithContext(ctx context.Context, input *cloudwatchlogs.StartQueryInput, option ...request.Option) (*cloudwatchlogs.StartQueryOutput, error) {
	args := m.Called(ctx, input, option)
	return args.Get(0).(*cloudwatchlogs.StartQueryOutput), args.Error(1)
}

func (m *fakeCWLogsClient) DescribeLogGroupsWithContext(ctx context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, option ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	m.calls.describeLogGroups = append(m.calls.describeLogGroups, input)
	output := &m.logGroups[m.logGroupsIndex]
	m.logGroupsIndex++
	return output, nil
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

// Please use mockEC2Client above, we are slowly migrating towards using testify's mocks only
type oldEC2Client struct {
	ec2iface.EC2API

	regions      []string
	reservations []*ec2.Reservation
}

func (c oldEC2Client) DescribeRegionsWithContext(ctx aws.Context, in *ec2.DescribeRegionsInput, option ...request.Option) (*ec2.DescribeRegionsOutput, error) {
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

func (c oldEC2Client) DescribeInstancesPagesWithContext(ctx aws.Context, in *ec2.DescribeInstancesInput,
	fn func(*ec2.DescribeInstancesOutput, bool) bool, opts ...request.Option) error {
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

func (c fakeRGTAClient) GetResourcesPagesWithContext(ctx context.Context, in *resourcegroupstaggingapi.GetResourcesInput,
	fn func(*resourcegroupstaggingapi.GetResourcesOutput, bool) bool, opts ...request.Option) error {
	fn(&resourcegroupstaggingapi.GetResourcesOutput{
		ResourceTagMappingList: c.tagMapping,
	}, true)
	return nil
}

type fakeCheckHealthClient struct {
	listMetricsPages  func(input *cloudwatch.ListMetricsInput, fn func(*cloudwatch.ListMetricsOutput, bool) bool) error
	describeLogGroups func(input *cloudwatchlogs.DescribeLogGroupsInput) (*cloudwatchlogs.DescribeLogGroupsOutput, error)
}

func (c fakeCheckHealthClient) ListMetricsPagesWithContext(ctx aws.Context, input *cloudwatch.ListMetricsInput, fn func(*cloudwatch.ListMetricsOutput, bool) bool, opts ...request.Option) error {
	if c.listMetricsPages != nil {
		return c.listMetricsPages(input, fn)
	}
	return nil
}

func (c fakeCheckHealthClient) DescribeLogGroupsWithContext(ctx context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, option ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	if c.describeLogGroups != nil {
		return c.describeLogGroups(input)
	}
	return nil, nil
}

func (c fakeCheckHealthClient) GetLogGroupFieldsWithContext(ctx context.Context, input *cloudwatchlogs.GetLogGroupFieldsInput, option ...request.Option) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	return nil, nil
}

func testInstanceManager(pageLimit int) instancemgmt.InstanceManager {
	return datasource.NewInstanceManager((func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return DataSource{Settings: models.CloudWatchSettings{
			AWSDatasourceSettings: awsds.AWSDatasourceSettings{
				Region: "us-east-1",
			},
			GrafanaSettings: awsds.AuthSettings{ListMetricsPageLimit: pageLimit},
		},
			sessions:      &fakeSessionCache{},
			tagValueCache: cache.New(0, 0)}, nil
	}))
}

func defaultTestInstanceManager() instancemgmt.InstanceManager {
	return testInstanceManager(1000)
}

type mockSessionCache struct {
	mock.Mock
}

func (c *mockSessionCache) GetSessionWithAuthSettings(config awsds.GetSessionConfig, auth awsds.AuthSettings) (*session.Session, error) {
	args := c.Called(config)
	return args.Get(0).(*session.Session), args.Error(1)
}

type fakeSessionCache struct {
	getSessionWithAuthSettings func(c awsds.GetSessionConfig, a awsds.AuthSettings) (*session.Session, error)
	calledRegions              []string
}

func (s *fakeSessionCache) GetSessionWithAuthSettings(c awsds.GetSessionConfig, a awsds.AuthSettings) (*session.Session, error) {
	s.calledRegions = append(s.calledRegions, c.Settings.Region)

	if s.getSessionWithAuthSettings != nil {
		return s.getSessionWithAuthSettings(c, a)
	}
	return &session.Session{
		Config: &aws.Config{},
	}, nil
}

type mockedCallResourceResponseSenderForOauth struct {
	Response *backend.CallResourceResponse
}

func (s *mockedCallResourceResponseSenderForOauth) Send(resp *backend.CallResourceResponse) error {
	s.Response = resp
	return nil
}

type fakeAWSError struct {
	code    string
	message string
}

func (e fakeAWSError) OrigErr() error {
	return nil
}

func (e fakeAWSError) Error() string {
	return e.message
}

func (e fakeAWSError) Code() string {
	return e.code
}

func (e fakeAWSError) Message() string {
	return e.message
}

func contextWithFeaturesEnabled(enabled ...string) context.Context {
	featureString := strings.Join(enabled, ",")
	cfg := backend.NewGrafanaCfg(map[string]string{featuretoggles.EnabledFeatures: featureString})
	return backend.WithGrafanaConfig(context.Background(), cfg)
}
