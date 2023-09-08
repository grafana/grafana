package services

import (
	"testing"

	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type EC2Mock struct {
	mock.Mock
}

func (e *EC2Mock) DescribeRegions(in *ec2.DescribeRegionsInput) (*ec2.DescribeRegionsOutput, error) {
	args := e.Called()
	mockResponse := args.Get(0)
	if mockResponse == nil {
		return nil, args.Error(1)
	}
	return mockResponse.(*ec2.DescribeRegionsOutput), args.Error(1)
}

func (e *EC2Mock) DescribeInstancesPages(in *ec2.DescribeInstancesInput, fn func(*ec2.DescribeInstancesOutput, bool) bool) error {
	args := e.Called(in, fn)
	return args.Error(0)
}

func TestRegions(t *testing.T) {
	t.Run("returns regions from the api and merges them with default regions", func(t *testing.T) {
		mockRegions := &ec2.DescribeRegionsOutput{
			Regions: []*ec2.Region{
				{
					RegionName: utils.Pointer("earth-1"),
				},
			},
		}
		ec2Mock := &EC2Mock{}
		ec2Mock.On("DescribeRegions").Return(mockRegions, nil)
		regions, err := NewRegionsService(ec2Mock).GetRegions()
		assert.NoError(t, err)
		assert.Contains(t, regions, resources.ResourceResponse[resources.Region]{
			Value: resources.Region{
				Name: "us-east-2",
			},
		})
		assert.Contains(t, regions, resources.ResourceResponse[resources.Region]{
			Value: resources.Region{
				Name: "earth-1",
			},
		})
	})

	t.Run("forwards error if DescribeRegions errors out", func(t *testing.T) {
		ec2Mock := &EC2Mock{}
		ec2Mock.On("DescribeRegions").Return(nil, assert.AnError)
		_, err := NewRegionsService(ec2Mock).GetRegions()
		assert.Error(t, err)
	})
}
