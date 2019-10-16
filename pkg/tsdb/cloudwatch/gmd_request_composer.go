package cloudwatch

import (
	"errors"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *CloudWatchExecutor) buildGetMetricDataQueries(queryContext *tsdb.TsdbQuery, queries []*CloudWatchQuery) ([]*cloudwatch.GetMetricDataInput, error) {
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

	params := &cloudwatch.GetMetricDataInput{
		StartTime: aws.Time(startTime),
		EndTime:   aws.Time(endTime),
		ScanBy:    aws.String("TimestampAscending"),
	}
	noOfSearchExpressions := 0

	for _, query := range queries {

		// 1 minutes resolution metrics is stored for 15 days, 15 * 24 * 60 = 21600
		if query.HighResolution && (((endTime.Unix() - startTime.Unix()) / int64(query.Period)) > 21600) {
			return nil, &queryBuilderError{errors.New("too long query period"), query.RefId}
		}

		metricDataQueries, err := e.buildMetricDataQueries(query)
		if err != nil {
			return nil, &queryBuilderError{err, query.RefId}
		}

		if err != nil {
			return nil, &queryBuilderError{err, query.RefId}
		}

		for _, metricDataQuery := range metricDataQueries {
			isSearchExpressions := metricDataQuery.Expression != nil && strings.Index(*metricDataQuery.Expression, "SEARCH(") != -1
			if isSearchExpressions && noOfSearchExpressions == 5 || len(params.MetricDataQueries) == 100 {
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
