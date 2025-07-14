package services

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/ec2"
	ec2types "github.com/aws/aws-sdk-go-v2/service/ec2/types"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/stretchr/testify/assert"
)

var testLogger = log.New().With("logger", "test.logger")

func TestRegions(t *testing.T) {
	t.Run("returns regions from the api and merges them with default regions", func(t *testing.T) {
		mockRegions := &ec2.DescribeRegionsOutput{
			Regions: []ec2types.Region{
				{
					RegionName: utils.Pointer("earth-1"),
				},
			},
		}
		ec2Mock := &mocks.EC2Mock{}
		ec2Mock.On("DescribeRegions").Return(mockRegions, nil)
		regions, err := NewRegionsService(ec2Mock, testLogger).GetRegions(context.Background())
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

	t.Run("always returns default regions, even if fetch fails", func(t *testing.T) {
		ec2Mock := &mocks.EC2Mock{}
		mockRegions := &ec2.DescribeRegionsOutput{
			Regions: []ec2types.Region{},
		}
		ec2Mock.On("DescribeRegions").Return(mockRegions, assert.AnError)
		regions, err := NewRegionsService(ec2Mock, testLogger).GetRegions(context.Background())
		assert.NoError(t, err)
		assert.Contains(t, regions, resources.ResourceResponse[resources.Region]{
			Value: resources.Region{
				Name: "us-east-2",
			},
		})
	})
}
