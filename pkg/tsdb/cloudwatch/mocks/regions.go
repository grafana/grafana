package mocks

import (
	"context"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/mock"
)

type RegionsService struct {
	mock.Mock
}

func (r *RegionsService) GetRegions(ctx context.Context) (in []resources.ResourceResponse[resources.Region], e error) {
	args := r.Called()
	return args.Get(0).(([]resources.ResourceResponse[resources.Region])), args.Error(1)
}

type EC2Mock struct {
	mock.Mock
}

func (e *EC2Mock) DescribeRegionsWithContext(ctx aws.Context, in *ec2.DescribeRegionsInput, opts ...request.Option) (*ec2.DescribeRegionsOutput, error) {
	args := e.Called()
	return args.Get(0).(*ec2.DescribeRegionsOutput), args.Error(1)
}

func (e *EC2Mock) DescribeInstancesPagesWithContext(ctx aws.Context, in *ec2.DescribeInstancesInput, fn func(*ec2.DescribeInstancesOutput, bool) bool, opts ...request.Option) error {
	args := e.Called(in, fn)
	return args.Error(0)
}
