package services

import (
	"sort"

	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/constants"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type RegionsService struct {
	models.EC2APIProvider
}

func NewRegionsService(ec2client models.EC2APIProvider) models.RegionsAPIProvider {
	return &RegionsService{
		ec2client,
	}
}

func mergeEC2RegionsAndConstantRegions(regions map[string]struct{}, ec2Regions []*ec2.Region) {
	for _, region := range ec2Regions {
		if _, ok := regions[*region.RegionName]; !ok {
			regions[*region.RegionName] = struct{}{}
		}
	}
}

func (r *RegionsService) GetRegions() ([]resources.ResourceResponse[resources.Region], error) {
	regions := constants.Regions()

	result := make([]resources.ResourceResponse[resources.Region], 0)

	ec2Regions, err := r.DescribeRegions(&ec2.DescribeRegionsInput{})
	if err != nil {
		return nil, err
	}

	mergeEC2RegionsAndConstantRegions(regions, ec2Regions.Regions)

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
