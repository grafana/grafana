package services

import (
	"context"
	"sort"
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

		// Cap total results when listing all to avoid unbounded memory and time
		if int32(len(result)) >= resources.MaxLogGroupsResults {
			result = result[:resources.MaxLogGroupsResults]
			break
		}

		if !req.ListAllLogGroups || response.NextToken == nil {
			break
		}
		input.NextToken = response.NextToken
	}

	if len(result) > int(resources.MaxLogGroupsResults) {
		result = result[:resources.MaxLogGroupsResults]
	}

	sortLogGroupsBy(result, req.OrderBy)
	return result, nil
}

// sortLogGroupsBy sorts result in place by name or accountId, asc or desc.
func sortLogGroupsBy(result []resources.ResourceResponse[resources.LogGroup], orderBy string) {
	if orderBy == "" {
		return
	}
	accountId := func(r resources.ResourceResponse[resources.LogGroup]) string {
		if r.AccountId != nil {
			return *r.AccountId
		}
		return ""
	}
	switch orderBy {
	case resources.OrderByNameAsc:
		sort.Slice(result, func(i, j int) bool { return strings.Compare(result[i].Value.Name, result[j].Value.Name) < 0 })
	case resources.OrderByNameDesc:
		sort.Slice(result, func(i, j int) bool { return strings.Compare(result[i].Value.Name, result[j].Value.Name) > 0 })
	case resources.OrderByAccountIDAsc:
		sort.Slice(result, func(i, j int) bool { return strings.Compare(accountId(result[i]), accountId(result[j])) < 0 })
	case resources.OrderByAccountIDDesc:
		sort.Slice(result, func(i, j int) bool { return strings.Compare(accountId(result[i]), accountId(result[j])) > 0 })
	}
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
