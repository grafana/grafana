package services

import (
	"context"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	cloudwatchlogstypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type DataSourcesService struct {
	logsAPI               models.CloudWatchLogsAPIProvider
	isCrossAccountEnabled bool
}

var NewDataSourcesService = func(logsClient models.CloudWatchLogsAPIProvider, isCrossAccountEnabled bool) models.DataSourcesProvider {
	return &DataSourcesService{logsAPI: logsClient, isCrossAccountEnabled: isCrossAccountEnabled}
}

func (s *DataSourcesService) GetDataSources(ctx context.Context, req resources.DataSourcesRequest) ([]resources.ResourceResponse[resources.LogDataSource], error) {
	input := &cloudwatchlogs.ListAggregateLogGroupSummariesInput{
		GroupBy: cloudwatchlogstypes.ListAggregateLogGroupSummariesGroupByDataSourceNameAndType,
	}

	if s.isCrossAccountEnabled {
		input.IncludeLinkedAccounts = aws.Bool(true)
	}

	paginator := cloudwatchlogs.NewListAggregateLogGroupSummariesPaginator(s.logsAPI, input)
	results := make([]resources.ResourceResponse[resources.LogDataSource], 0)
	seen := make(map[string]struct{})
	pattern := strings.ToLower(strings.TrimSpace(aws.ToString(req.Pattern)))

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}

		for _, summary := range page.AggregateLogGroupSummaries {
			name, dataSourceType := parseDataSourceGroupingIdentifiers(summary.GroupingIdentifiers)
			if name == "" {
				name = "Unknown"
			}
			if dataSourceType == "" {
				dataSourceType = "Unknown"
			}

			if pattern != "" && !matchesDataSourcePattern(name, dataSourceType, pattern) {
				continue
			}

			key := strings.ToLower(name + "." + dataSourceType)
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			results = append(results, resources.ResourceResponse[resources.LogDataSource]{
				Value: resources.LogDataSource{
					Name: name,
					Type: dataSourceType,
				},
			})
		}
	}

	sort.Slice(results, func(i, j int) bool {
		left := strings.ToLower(results[i].Value.Name + "." + results[i].Value.Type)
		right := strings.ToLower(results[j].Value.Name + "." + results[j].Value.Type)
		return left < right
	})

	return results, nil
}

func parseDataSourceGroupingIdentifiers(identifiers []cloudwatchlogstypes.GroupingIdentifier) (string, string) {
	var name string
	var dataSourceType string

	for _, identifier := range identifiers {
		key := strings.ToLower(aws.ToString(identifier.Key))
		value := aws.ToString(identifier.Value)
		switch key {
		case "datasource.name":
			name = value
		case "datasource.type":
			dataSourceType = value
		}
	}

	return name, dataSourceType
}

func matchesDataSourcePattern(name string, dataSourceType string, pattern string) bool {
	nameLower := strings.ToLower(name)
	typeLower := strings.ToLower(dataSourceType)
	fullLower := nameLower + "." + typeLower
	return strings.Contains(nameLower, pattern) || strings.Contains(typeLower, pattern) || strings.Contains(fullLower, pattern)
}
