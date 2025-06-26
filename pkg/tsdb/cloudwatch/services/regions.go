package services

import (
	"context"
	"sort"

	"github.com/aws/aws-sdk-go-v2/service/ec2"
	ec2types "github.com/aws/aws-sdk-go-v2/service/ec2/types"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/constants"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type RegionsService struct {
	models.EC2APIProvider
	log.Logger
}

var NewRegionsService = func(ec2client models.EC2APIProvider, logger log.Logger) models.RegionsAPIProvider {
	return &RegionsService{
		ec2client,
		logger,
	}
}

func mergeEC2RegionsAndConstantRegions(regions map[string]struct{}, ec2Regions []ec2types.Region) {
	for _, region := range ec2Regions {
		if _, ok := regions[*region.RegionName]; !ok {
			regions[*region.RegionName] = struct{}{}
		}
	}
}

func (r *RegionsService) GetRegions(ctx context.Context) ([]resources.ResourceResponse[resources.Region], error) {
	regions := constants.Regions()

	result := make([]resources.ResourceResponse[resources.Region], 0)

	ec2Regions, err := r.DescribeRegions(ctx, &ec2.DescribeRegionsInput{})
	// we ignore this error and always send default regions
	// we only fetch incase a user has enabled additional regions
	// but we still log it in case the user is expecting to fetch regions specific to their account and are unable to
	if err != nil {
		r.Error("Failed to get regions: ", "error", err)
	}

	if ec2Regions != nil {
		mergeEC2RegionsAndConstantRegions(regions, ec2Regions.Regions)
	}

	for region := range regions {
		result = append(result, resources.ResourceResponse[resources.Region]{
			Value: resources.Region{
				Name: region,
			},
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Value.Name < result[j].Value.Name
	})

	return result, nil
}
