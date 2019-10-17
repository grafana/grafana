package cloudwatch

import (
	"errors"
	"fmt"
	"sort"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb"
)

type metricDataInputBuilder struct {
	maxNoOfSearchExpressions int
	maxNoOfMetricDataQueries int
}

func (mdib *metricDataInputBuilder) buildMetricDataInput(queryContext *tsdb.TsdbQuery, queries []*CloudWatchQuery) ([]*cloudwatch.GetMetricDataInput, error) {
	metricDataInputs := make([]*cloudwatch.GetMetricDataInput, 0)
	startTime, err := queryContext.TimeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	endTime, err := queryContext.TimeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	if !startTime.Before(endTime) {
		return nil, fmt.Errorf("Invalid time range: Start time must be before end time")
	}

	sortedQueries := sortQueries(queries)

	noOfSearchExpressions := 0
	params := &cloudwatch.GetMetricDataInput{
		StartTime: aws.Time(startTime),
		EndTime:   aws.Time(endTime),
		ScanBy:    aws.String("TimestampAscending"),
	}

	for _, query := range sortedQueries {
		// 1 minutes resolution metrics is stored for 15 days, 15 * 24 * 60 = 21600
		if query.HighResolution && (((endTime.Unix() - startTime.Unix()) / int64(query.Period)) > 21600) {
			return nil, &queryBuilderError{errors.New("too long query period"), query.RefId}
		}

		metricDataQueries, err := mdib.buildMetricDataQueries(query)
		if err != nil {
			return nil, &queryBuilderError{err, query.RefId}
		}

		if err != nil {
			return nil, &queryBuilderError{err, query.RefId}
		}

		for _, metricDataQuery := range metricDataQueries {
			isSearchExpressions := query.isSearchExpression()
			if isSearchExpressions && noOfSearchExpressions == mdib.maxNoOfSearchExpressions || len(params.MetricDataQueries) == mdib.maxNoOfMetricDataQueries {
				metricDataInputs = append(metricDataInputs, params)
				params = &cloudwatch.GetMetricDataInput{
					StartTime: aws.Time(startTime),
					EndTime:   aws.Time(endTime),
					ScanBy:    aws.String("TimestampAscending"),
				}
				noOfSearchExpressions = 0
			}
			params.MetricDataQueries = append(params.MetricDataQueries, metricDataQuery)

			if isSearchExpressions {
				noOfSearchExpressions++
			}
		}
	}

	metricDataInputs = append(metricDataInputs, params)

	return metricDataInputs, nil
}

func sortQueries(queries []*CloudWatchQuery) []*CloudWatchQuery {
	sort.SliceStable(queries, func(i, j int) bool {
		return getSortOrder(queries[i]) > getSortOrder(queries[j])
	})
	return queries
}

func getSortOrder(query *CloudWatchQuery) int {
	if len(query.Statistics) > 1 {
		if !query.isSearchExpression() {
			return 1
		}
		return 0
	}

	if query.Id != "" {
		// Give non search expressions with ids the higest priority
		if !query.isSearchExpression() {
			return 5
		}

		return 4
	} else if query.isMathExpression() {
		// Math expressions without ID can still reference other queries that have ids
		return 3
	}

	// We know the query is not being referenced nor references other queries
	// In this case, prioritize non search expressions so that the MetricDataInput is being filled to the extent possible
	if !query.isSearchExpression() {
		return 1
	}

	return 0
}
