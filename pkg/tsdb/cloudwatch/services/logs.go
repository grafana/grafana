package services

import (
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

type LogGroupsService struct {
	logGroupsAPI          models.CloudWatchLogsAPIProvider
	isCrossAccountEnabled bool
}

func NewLogGroupsService(logsClient models.CloudWatchLogsAPIProvider, isCrossAccountEnabled bool) models.LogGroupsProvider {
	return &LogGroupsService{logGroupsAPI: logsClient, isCrossAccountEnabled: isCrossAccountEnabled}
}

func (s *LogGroupsService) GetLogGroups(req resources.LogGroupsRequest) ([]resources.ResourceResponse[resources.LogGroup], error) {
	input := &cloudwatchlogs.DescribeLogGroupsInput{
		Limit:              aws.Int64(req.Limit),
		LogGroupNamePrefix: req.LogGroupNamePrefix,
	}

	if s.isCrossAccountEnabled && req.AccountId != nil {
		input.IncludeLinkedAccounts = aws.Bool(true)
		if req.LogGroupNamePattern != nil {
			input.LogGroupNamePrefix = req.LogGroupNamePattern
		}
		if !req.IsTargetingAllAccounts() {
			// TODO: accept more than one account id in search
			input.AccountIdentifiers = []*string{req.AccountId}
		}
	}
	response, err := s.logGroupsAPI.DescribeLogGroups(input)
	if err != nil || response == nil {
		return nil, err
	}

	var result []resources.ResourceResponse[resources.LogGroup]
	for _, logGroup := range response.LogGroups {
		result = append(result, resources.ResourceResponse[resources.LogGroup]{
			Value: resources.LogGroup{
				Arn:  *logGroup.Arn,
				Name: *logGroup.LogGroupName,
			},
			AccountId: utils.Pointer(getAccountId(*logGroup.Arn)),
		})
	}

	return result, nil
}
