package mocks

import (
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/mock"
)

type RegionsService struct {
	mock.Mock
}

func (r *RegionsService) GetRegions() ([]resources.ResourceResponse[resources.Region], error) {
	args := r.Called()
	return args.Get(0).(([]resources.ResourceResponse[resources.Region])), args.Error(1)
}

type EC2Mock struct {
	mock.Mock
}

func (e *EC2Mock) DescribeRegions(in *ec2.DescribeRegionsInput) (*ec2.DescribeRegionsOutput, error) {
	args := e.Called()
	return args.Get(0).(*ec2.DescribeRegionsOutput), args.Error(1)
}

func (e *EC2Mock) DescribeInstancesPages(in *ec2.DescribeInstancesInput, fn func(*ec2.DescribeInstancesOutput, bool) bool) error {
	args := e.Called(in, fn)
	return args.Error(0)
}
