package mocks

import (
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/stretchr/testify/mock"
)

type FakeMetricsClient struct {
	mock.Mock
}

func (m *FakeMetricsClient) ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]*cloudwatch.Metric, error) {
	args := m.Called(params)
	return args.Get(0).([]*cloudwatch.Metric), args.Error(1)
}

var MetricResponse = []*cloudwatch.Metric{
	{
		MetricName: aws.String("CPUUtilization"),
		Namespace:  aws.String("AWS/EC2"),
		Dimensions: []*cloudwatch.Dimension{
			{Name: aws.String("InstanceId"), Value: aws.String("i-1234567890abcdef0")},
			{Name: aws.String("InstanceType"), Value: aws.String("t2.micro")},
		},
	},
	{
		MetricName: aws.String("CPUUtilization"),
		Namespace:  aws.String("AWS/EC2"),
		Dimensions: []*cloudwatch.Dimension{
			{Name: aws.String("InstanceId"), Value: aws.String("i-5234567890abcdef0")},
			{Name: aws.String("InstanceType"), Value: aws.String("t2.micro")},
			{Name: aws.String("AutoScalingGroupName"), Value: aws.String("my-asg")},
		},
	},
	{
		MetricName: aws.String("CPUUtilization"),
		Namespace:  aws.String("AWS/EC2"),
		Dimensions: []*cloudwatch.Dimension{
			{Name: aws.String("InstanceId"), Value: aws.String("i-64234567890abcdef0")},
			{Name: aws.String("InstanceType"), Value: aws.String("t3.micro")},
			{Name: aws.String("AutoScalingGroupName"), Value: aws.String("my-asg2")},
		},
	},
}
