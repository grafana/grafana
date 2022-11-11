package services

import (
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type LogGroupsService struct {
	logGroupsAPI models.CloudWatchLogsAPIProvider
}

func NewLogGroupsService(logsClient models.CloudWatchLogsAPIProvider) models.LogGroupsProvider {
	return &LogGroupsService{logGroupsAPI: logsClient}
}

func (s *LogGroupsService) GetLogGroups(req resources.LogsRequest) ([]resources.ResourceResponse[resources.LogGroup], error) {
	input := &cloudwatchlogs.DescribeLogGroupsInput{
		Limit:              aws.Int64(req.Limit),
		LogGroupNamePrefix: req.LogGroupNamePrefix,
	}

	if req.IsCrossAccountQueryingEnabled && req.AccountId != nil {
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
	if err != nil {
		return nil, err
	}

	var result []resources.ResourceResponse[resources.LogGroup]
	for _, logGroup := range response.LogGroups {
		result = append(result, resources.ResourceResponse[resources.LogGroup]{
			Value: resources.LogGroup{
				Arn:  *logGroup.Arn,
				Name: *logGroup.LogGroupName,
			},
			AccountId: pointer(getAccountId(*logGroup.Arn)),
		})
	}

	return result, nil
}
