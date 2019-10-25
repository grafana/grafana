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

func (mdib *metricDataInputBuilder) buildMetricDataInputs(queryContext *tsdb.TsdbQuery, queries []*cloudWatchQuery) ([]*cloudwatch.GetMetricDataInput, error) {
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

	metricStatQueries, nonMetricStatQueries := mdib.splitQueries(queries)

	if len(metricStatQueries) > 0 {
		mdi := &cloudwatch.GetMetricDataInput{
			StartTime: aws.Time(startTime),
			EndTime:   aws.Time(endTime),
			ScanBy:    aws.String("TimestampAscending"),
		}
		for _, metricStatQuery := range metricStatQueries {
			// 1 minutes resolution metrics is stored for 15 days, 15 * 24 * 60 = 21600
			if metricStatQuery.HighResolution && (((endTime.Unix() - startTime.Unix()) / int64(metricStatQuery.Period)) > 21600) {
				return nil, &queryBuilderError{errors.New("too long query period"), metricStatQuery.RefId}
			}

			metricDataQuery, err := mdib.buildMetricDataQuery(metricStatQuery)
			if err != nil {
				return nil, &queryBuilderError{err, metricStatQuery.RefId}
			}
			mdi.MetricDataQueries = append(mdi.MetricDataQueries, metricDataQuery)
		}
		metricDataInputs = append(metricDataInputs, mdi)
	}

	if len(nonMetricStatQueries) == 0 {
		return metricDataInputs, nil
	}

	mdib.sortQueries(nonMetricStatQueries)

	mdi := &cloudwatch.GetMetricDataInput{
		StartTime: aws.Time(startTime),
		EndTime:   aws.Time(endTime),
		ScanBy:    aws.String("TimestampAscending"),
	}

	noOfSearchExpressions := 0
	for _, query := range nonMetricStatQueries {
		if query.HighResolution && (((endTime.Unix() - startTime.Unix()) / int64(query.Period)) > 21600) {
			return nil, &queryBuilderError{errors.New("too long query period"), query.RefId}
		}
		metricDataQuery, err := mdib.buildMetricDataQuery(query)
		if err != nil {
			return nil, &queryBuilderError{err, query.RefId}
		}

		isSearchExpressions := query.isSearchExpression()
		if isSearchExpressions && noOfSearchExpressions == mdib.maxNoOfSearchExpressions || len(mdi.MetricDataQueries) == mdib.maxNoOfMetricDataQueries {
			metricDataInputs = append(metricDataInputs, mdi)
			mdi = &cloudwatch.GetMetricDataInput{
				StartTime: aws.Time(startTime),
				EndTime:   aws.Time(endTime),
				ScanBy:    aws.String("TimestampAscending"),
			}
			noOfSearchExpressions = 0
		}

		mdi.MetricDataQueries = append(mdi.MetricDataQueries, metricDataQuery)

		if isSearchExpressions {
			noOfSearchExpressions++
		}
	}

	metricDataInputs = append(metricDataInputs, mdi)

	return metricDataInputs, nil
}

func (mdib *metricDataInputBuilder) splitQueries(queries []*cloudWatchQuery) ([]*cloudWatchQuery, []*cloudWatchQuery) {
	metricStatQueriesWithoutUserDefinedID, otherQueries := []*cloudWatchQuery{}, []*cloudWatchQuery{}
	for _, query := range queries {
		if query.UserDefinedId == "" && query.isMetricStat() {
			metricStatQueriesWithoutUserDefinedID = append(metricStatQueriesWithoutUserDefinedID, query)
		} else {
			otherQueries = append(otherQueries, query)
		}
	}

	return metricStatQueriesWithoutUserDefinedID, otherQueries
}

func (mdib *metricDataInputBuilder) sortQueries(queries []*cloudWatchQuery) {
	sort.SliceStable(queries, func(i, j int) bool {
		return mdib.getSortOrder(queries[i]) > mdib.getSortOrder(queries[j])
	})
}

func (mdib *metricDataInputBuilder) getSortOrder(query *cloudWatchQuery) int {
	if query.isMetricStat() {
		return 3
	} else if query.isMathExpression() {
		return 2
	}

	return 1
}
