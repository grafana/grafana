package services

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

type LogGroupsService struct {
	logGroupsAPI          models.CloudWatchLogsAPIProvider
	isCrossAccountEnabled bool
}

var NewLogGroupsService = func(logsClient models.CloudWatchLogsAPIProvider, isCrossAccountEnabled bool) models.LogGroupsProvider {
	return &LogGroupsService{logGroupsAPI: logsClient, isCrossAccountEnabled: isCrossAccountEnabled}
}

func (s *LogGroupsService) GetLogGroups(ctx context.Context, req resources.LogGroupsRequest) ([]resources.ResourceResponse[resources.LogGroup], error) {
	input := &cloudwatchlogs.DescribeLogGroupsInput{
		Limit:              aws.Int32(req.Limit),
		LogGroupNamePrefix: req.LogGroupNamePrefix,
	}

	if s.isCrossAccountEnabled && req.AccountId != nil {
		input.IncludeLinkedAccounts = aws.Bool(true)
		if req.LogGroupNamePattern != nil {
			input.LogGroupNamePrefix = req.LogGroupNamePattern
		}
		if !req.IsTargetingAllAccounts() {
			// TODO: accept more than one account id in search
			input.AccountIdentifiers = []string{*req.AccountId}
		}
	}
	result := []resources.ResourceResponse[resources.LogGroup]{}

	for {
		response, err := s.logGroupsAPI.DescribeLogGroups(ctx, input)
		if err != nil || response == nil {
			return nil, err
		}

		for _, logGroup := range response.LogGroups {
			result = append(result, resources.ResourceResponse[resources.LogGroup]{
				Value: resources.LogGroup{
					Arn:  *logGroup.Arn,
					Name: *logGroup.LogGroupName,
				},
				AccountId: utils.Pointer(getAccountId(*logGroup.Arn)),
			})
		}

		if !req.ListAllLogGroups || response.NextToken == nil {
			break
		}
		input.NextToken = response.NextToken
	}

	return result, nil
}

func (s *LogGroupsService) GetLogGroupFields(ctx context.Context, request resources.LogGroupFieldsRequest) ([]resources.ResourceResponse[resources.LogGroupField], error) {
	input := &cloudwatchlogs.GetLogGroupFieldsInput{
		LogGroupName: aws.String(request.LogGroupName),
	}
	// we should use LogGroupIdentifier instead of LogGroupName, but currently the api doesn't accept LogGroupIdentifier. need to check if it's a bug or not.
	// if request.LogGroupARN != "" {
	// 	input.LogGroupIdentifier = aws.String(strings.TrimSuffix(request.LogGroupARN, ":*"))
	// 	input.LogGroupName = nil
	// }

	getLogGroupFieldsOutput, err := s.logGroupsAPI.GetLogGroupFields(ctx, input)
	if err != nil {
		return nil, err
	}

	result := make([]resources.ResourceResponse[resources.LogGroupField], 0)
	for _, logGroupField := range getLogGroupFieldsOutput.LogGroupFields {
		result = append(result, resources.ResourceResponse[resources.LogGroupField]{
			Value: resources.LogGroupField{
				Name:    *logGroupField.Name,
				Percent: int64(logGroupField.Percent),
			},
		})
	}

	return result, nil
}
