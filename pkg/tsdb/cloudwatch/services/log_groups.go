package services

import (
	"context"
	"slices"
	"strings"

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

	sortLogGroups(result, req)

	return result, nil
}

func sortLogGroups(logGroups []resources.ResourceResponse[resources.LogGroup], req resources.LogGroupsRequest) {
	searchTerm := ""
	if req.LogGroupNamePattern != nil {
		searchTerm = strings.ToLower(*req.LogGroupNamePattern)
	} else if req.LogGroupNamePrefix != nil {
		searchTerm = strings.ToLower(*req.LogGroupNamePrefix)
	}

	slices.SortFunc(logGroups, func(a, b resources.ResourceResponse[resources.LogGroup]) int {
		if diff := compareMatchPriority(a.Value.Name, b.Value.Name, searchTerm); diff != 0 {
			return diff
		}

		if diff := strings.Compare(strings.ToLower(a.Value.Name), strings.ToLower(b.Value.Name)); diff != 0 {
			return diff
		}

		if diff := strings.Compare(a.Value.Name, b.Value.Name); diff != 0 {
			return diff
		}

		if diff := strings.Compare(pointerValue(a.AccountId), pointerValue(b.AccountId)); diff != 0 {
			return diff
		}

		return strings.Compare(a.Value.Arn, b.Value.Arn)
	})
}

func compareMatchPriority(leftName, rightName, searchTerm string) int {
	if searchTerm == "" {
		return 0
	}

	leftPriority := matchPriority(strings.ToLower(leftName), searchTerm)
	rightPriority := matchPriority(strings.ToLower(rightName), searchTerm)

	switch {
	case leftPriority < rightPriority:
		return -1
	case leftPriority > rightPriority:
		return 1
	default:
		return 0
	}
}

func matchPriority(name, searchTerm string) int {
	switch {
	case name == searchTerm:
		return 0
	case strings.HasPrefix(name, searchTerm):
		return 1
	case strings.Contains(name, searchTerm):
		return 2
	default:
		return 3
	}
}

func pointerValue(value *string) string {
	if value == nil {
		return ""
	}

	return *value
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
