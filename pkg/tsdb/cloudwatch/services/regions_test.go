package services

import (
	"testing"

	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/stretchr/testify/assert"
)

func TestRegions(t *testing.T) {
	t.Run("returns regions from the api and merges them with default regions", func(t *testing.T) {
		mockRegions := &ec2.DescribeRegionsOutput{
			Regions: []*ec2.Region{
				{
					RegionName: utils.Pointer("earth-1"),
				},
			},
		}
		ec2Mock := &mocks.EC2Mock{}
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
		ec2Mock := &mocks.EC2Mock{}
		ec2Mock.On("DescribeRegions").Return((*ec2.DescribeRegionsOutput)(nil), assert.AnError)
		_, err := NewRegionsService(ec2Mock).GetRegions()
		assert.Error(t, err)
	})
}
