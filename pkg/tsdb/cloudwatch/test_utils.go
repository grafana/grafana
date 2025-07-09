package cloudwatch

import (
	"context"
	"strings"

	"github.com/aws/smithy-go"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	cloudwatchlogstypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	ec2types "github.com/aws/aws-sdk-go-v2/service/ec2/types"
	"github.com/aws/aws-sdk-go-v2/service/resourcegroupstaggingapi"
	resourcegroupstaggingapitypes "github.com/aws/aws-sdk-go-v2/service/resourcegroupstaggingapi/types"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/mock"
)

type fakeCWLogsClient struct {
	calls logsQueryCalls

	logGroups      []cloudwatchlogs.DescribeLogGroupsOutput
	logGroupFields cloudwatchlogs.GetLogGroupFieldsOutput
	queryResults   cloudwatchlogs.GetQueryResultsOutput

	logGroupsIndex int
}

type logsQueryCalls struct {
	startQuery        []*cloudwatchlogs.StartQueryInput
	getEvents         []*cloudwatchlogs.GetLogEventsInput
	describeLogGroups []*cloudwatchlogs.DescribeLogGroupsInput
}

func (m *fakeCWLogsClient) GetQueryResults(_ context.Context, _ *cloudwatchlogs.GetQueryResultsInput, _ ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	return &m.queryResults, nil
}

func (m *fakeCWLogsClient) StartQuery(_ context.Context, input *cloudwatchlogs.StartQueryInput, _ ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.StartQueryOutput, error) {
	m.calls.startQuery = append(m.calls.startQuery, input)

	return &cloudwatchlogs.StartQueryOutput{
		QueryId: aws.String("abcd-efgh-ijkl-mnop"),
	}, nil
}

func (m *fakeCWLogsClient) StopQuery(_ context.Context, _ *cloudwatchlogs.StopQueryInput, _ ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.StopQueryOutput, error) {
	return &cloudwatchlogs.StopQueryOutput{
		Success: true,
	}, nil
}

type mockLogsSyncClient struct {
	mock.Mock
}

func (m *mockLogsSyncClient) StopQuery(context.Context, *cloudwatchlogs.StopQueryInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.StopQueryOutput, error) {
	return nil, nil
}

func (m *mockLogsSyncClient) GetLogEvents(context.Context, *cloudwatchlogs.GetLogEventsInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetLogEventsOutput, error) {
	return nil, nil
}

func (m *mockLogsSyncClient) DescribeLogGroups(context.Context, *cloudwatchlogs.DescribeLogGroupsInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	return nil, nil
}

func (m *mockLogsSyncClient) GetQueryResults(ctx context.Context, input *cloudwatchlogs.GetQueryResultsInput, optFns ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	args := m.Called(ctx, input, optFns)
	return args.Get(0).(*cloudwatchlogs.GetQueryResultsOutput), args.Error(1)
}
func (m *mockLogsSyncClient) StartQuery(ctx context.Context, input *cloudwatchlogs.StartQueryInput, optFns ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.StartQueryOutput, error) {
	args := m.Called(ctx, input, optFns)
	return args.Get(0).(*cloudwatchlogs.StartQueryOutput), args.Error(1)
}

func (m *fakeCWLogsClient) DescribeLogGroups(_ context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, _ ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	m.calls.describeLogGroups = append(m.calls.describeLogGroups, input)
	output := &m.logGroups[m.logGroupsIndex]
	m.logGroupsIndex++
	return output, nil
}

func (m *fakeCWLogsClient) GetLogGroupFields(_ context.Context, _ *cloudwatchlogs.GetLogGroupFieldsInput, _ ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	return &m.logGroupFields, nil
}

func (m *fakeCWLogsClient) GetLogEvents(_ context.Context, input *cloudwatchlogs.GetLogEventsInput, _ ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetLogEventsOutput, error) {
	m.calls.getEvents = append(m.calls.getEvents, input)

	return &cloudwatchlogs.GetLogEventsOutput{
		Events: []cloudwatchlogstypes.OutputLogEvent{},
	}, nil
}

type fakeCWAnnotationsClient struct {
	calls annontationsQueryCalls

	describeAlarmsForMetricOutput *cloudwatch.DescribeAlarmsForMetricOutput
	describeAlarmsOutput          *cloudwatch.DescribeAlarmsOutput
}

func (c *fakeCWAnnotationsClient) DescribeAlarmHistory(ctx context.Context, input *cloudwatch.DescribeAlarmHistoryInput, f ...func(*cloudwatch.Options)) (*cloudwatch.DescribeAlarmHistoryOutput, error) {
	return nil, nil
}

func (c *fakeCWAnnotationsClient) GetMetricData(ctx context.Context, input *cloudwatch.GetMetricDataInput, f ...func(*cloudwatch.Options)) (*cloudwatch.GetMetricDataOutput, error) {
	return nil, nil
}

func (c *fakeCWAnnotationsClient) ListMetrics(ctx context.Context, input *cloudwatch.ListMetricsInput, f ...func(*cloudwatch.Options)) (*cloudwatch.ListMetricsOutput, error) {
	return nil, nil
}

type annontationsQueryCalls struct {
	describeAlarmsForMetric []*cloudwatch.DescribeAlarmsForMetricInput
	describeAlarms          []*cloudwatch.DescribeAlarmsInput
}

func (c *fakeCWAnnotationsClient) DescribeAlarmsForMetric(_ context.Context, params *cloudwatch.DescribeAlarmsForMetricInput, _ ...func(*cloudwatch.Options)) (*cloudwatch.DescribeAlarmsForMetricOutput, error) {
	c.calls.describeAlarmsForMetric = append(c.calls.describeAlarmsForMetric, params)

	return c.describeAlarmsForMetricOutput, nil
}

func (c *fakeCWAnnotationsClient) DescribeAlarms(_ context.Context, params *cloudwatch.DescribeAlarmsInput, _ ...func(*cloudwatch.Options)) (*cloudwatch.DescribeAlarmsOutput, error) {
	c.calls.describeAlarms = append(c.calls.describeAlarms, params)

	return c.describeAlarmsOutput, nil
}

// Please use mockEC2Client above, we are slowly migrating towards using testify's mocks only
type oldEC2Client struct {
	regions      []string
	reservations []ec2types.Reservation
}

func (c oldEC2Client) DescribeRegions(_ context.Context, _ *ec2.DescribeRegionsInput, _ ...func(*ec2.Options)) (*ec2.DescribeRegionsOutput, error) {
	regions := []ec2types.Region{}
	for _, region := range c.regions {
		regions = append(regions, ec2types.Region{
			RegionName: aws.String(region),
		})
	}
	return &ec2.DescribeRegionsOutput{
		Regions: regions,
	}, nil
}

func (c oldEC2Client) DescribeInstances(_ context.Context, in *ec2.DescribeInstancesInput, _ ...func(*ec2.Options)) (*ec2.DescribeInstancesOutput, error) {
	reservations := []ec2types.Reservation{}
	for _, r := range c.reservations {
		instances := []ec2types.Instance{}
		for _, inst := range r.Instances {
			if len(in.InstanceIds) == 0 {
				instances = append(instances, inst)
				continue
			}

			for _, id := range in.InstanceIds {
				if *inst.InstanceId == id {
					instances = append(instances, inst)
				}
			}
		}
		reservation := ec2types.Reservation{Instances: instances}
		reservations = append(reservations, reservation)
	}
	return &ec2.DescribeInstancesOutput{
		Reservations: reservations,
	}, nil
}

type fakeRGTAClient struct {
	tagMapping []resourcegroupstaggingapitypes.ResourceTagMapping
}

func (c fakeRGTAClient) GetResources(_ context.Context, _ *resourcegroupstaggingapi.GetResourcesInput, _ ...func(*resourcegroupstaggingapi.Options)) (*resourcegroupstaggingapi.GetResourcesOutput, error) {
	return &resourcegroupstaggingapi.GetResourcesOutput{
		ResourceTagMappingList: c.tagMapping,
	}, nil
}

type fakeCheckHealthClient struct {
	listMetricsFunction       func(context.Context, *cloudwatch.ListMetricsInput, ...func(*cloudwatch.Options)) (*cloudwatch.ListMetricsOutput, error)
	describeLogGroupsFunction func(context.Context, *cloudwatchlogs.DescribeLogGroupsInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.DescribeLogGroupsOutput, error)

	models.CWClient
}

func (c fakeCheckHealthClient) ListMetrics(ctx context.Context, input *cloudwatch.ListMetricsInput, _ ...func(*cloudwatch.Options)) (*cloudwatch.ListMetricsOutput, error) {
	if c.listMetricsFunction != nil {
		return c.listMetricsFunction(ctx, input)
	}
	return &cloudwatch.ListMetricsOutput{}, nil
}

func (c fakeCheckHealthClient) DescribeLogGroups(ctx context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, _ ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	if c.describeLogGroupsFunction != nil {
		return c.describeLogGroupsFunction(ctx, input)
	}
	return nil, nil
}

func (c fakeCheckHealthClient) GetLogGroupFields(_ context.Context, _ *cloudwatchlogs.GetLogGroupFieldsInput, _ ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	return nil, nil
}

type FakeCredentialsProvider struct {
}

func (fcp *FakeCredentialsProvider) Retrieve(_ context.Context) (aws.Credentials, error) {
	return aws.Credentials{}, nil
}

type mockedCallResourceResponseSenderForOauth struct {
	Response *backend.CallResourceResponse
}

func (s *mockedCallResourceResponseSenderForOauth) Send(resp *backend.CallResourceResponse) error {
	s.Response = resp
	return nil
}

type fakeSmithyError struct {
	code    string
	message string
}

func (f fakeSmithyError) Error() string {
	return f.message
}

func (f fakeSmithyError) ErrorCode() string {
	return f.code
}

func (f fakeSmithyError) ErrorMessage() string {
	return f.message
}

func (f fakeSmithyError) ErrorFault() smithy.ErrorFault {
	return 0
}

func contextWithFeaturesEnabled(enabled ...string) context.Context {
	featureString := strings.Join(enabled, ",")
	cfg := backend.NewGrafanaCfg(map[string]string{featuretoggles.EnabledFeatures: featureString})
	return backend.WithGrafanaConfig(context.Background(), cfg)
}
