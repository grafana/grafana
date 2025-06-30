package mocks

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/mock"
)

type RegionsService struct {
	mock.Mock
}

func (r *RegionsService) GetRegions(_ context.Context) (in []resources.ResourceResponse[resources.Region], e error) {
	args := r.Called()
	return args.Get(0).([]resources.ResourceResponse[resources.Region]), args.Error(1)
}

type EC2Mock struct {
	mock.Mock
}

func (e *EC2Mock) DescribeRegions(_ context.Context, _ *ec2.DescribeRegionsInput, _ ...func(*ec2.Options)) (*ec2.DescribeRegionsOutput, error) {
	args := e.Called()
	return args.Get(0).(*ec2.DescribeRegionsOutput), args.Error(1)
}

func (e *EC2Mock) DescribeInstances(_ context.Context, in *ec2.DescribeInstancesInput, _ ...func(*ec2.Options)) (*ec2.DescribeInstancesOutput, error) {
	args := e.Called(in)
	return nil, args.Error(0)
}
