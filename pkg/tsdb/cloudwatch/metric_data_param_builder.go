package cloudwatch

import (
	"errors"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/tsdb"
)

type metricDataParamBuilder struct {
	maxNoOfSearchExpressions int
	maxNoOfMetricDataQueries int
}

func (mdpb *metricDataParamBuilder) build(queryContext *tsdb.TsdbQuery, queries []*cloudWatchQuery) ([]*metricDataParam, error) {
	metricDataParams := make([]*metricDataParam, 0)
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

	metricStatQueries, nonMetricStatQueries := mdpb.splitQueries(queries)

	if len(metricStatQueries) > 0 {
		mdp := newMetricDataParam(startTime, endTime)
		for _, metricStatQuery := range metricStatQueries {
			// 1 minutes resolution metrics is stored for 15 days, 15 * 24 * 60 = 21600
			if metricStatQuery.HighResolution && (((endTime.Unix() - startTime.Unix()) / int64(metricStatQuery.Period)) > 21600) {
				return nil, &queryBuilderError{errors.New("too long query period"), metricStatQuery.RefId}
			}

			metricDataQuery, err := mdpb.buildMetricDataQuery(metricStatQuery)
			if err != nil {
				return nil, &queryBuilderError{err, metricStatQuery.RefId}
			}
			mdp.MetricDataInput.MetricDataQueries = append(mdp.MetricDataInput.MetricDataQueries, metricDataQuery)
			mdp.CloudwatchQueries = append(mdp.CloudwatchQueries, metricStatQuery)
		}
		// metricDataInputs = append(metricDataInputs, mdi)
		metricDataParams = append(metricDataParams, mdp)
	}

	if len(nonMetricStatQueries) == 0 {
		return metricDataParams, nil
	}

	mdpb.sortQueries(nonMetricStatQueries)

	mdp := newMetricDataParam(startTime, endTime)
	// mdi := &cloudwatch.GetMetricDataInput{
	// 	StartTime: aws.Time(startTime),
	// 	EndTime:   aws.Time(endTime),
	// 	ScanBy:    aws.String("TimestampAscending"),
	// }

	noOfSearchExpressions := 0
	for _, query := range nonMetricStatQueries {
		if query.HighResolution && (((endTime.Unix() - startTime.Unix()) / int64(query.Period)) > 21600) {
			return nil, &queryBuilderError{errors.New("too long query period"), query.RefId}
		}
		metricDataQuery, err := mdpb.buildMetricDataQuery(query)
		if err != nil {
			return nil, &queryBuilderError{err, query.RefId}
		}

		isSearchExpressions := query.isSearchExpression()
		if isSearchExpressions && noOfSearchExpressions == mdpb.maxNoOfSearchExpressions || len(mdp.MetricDataInput.MetricDataQueries) == mdpb.maxNoOfMetricDataQueries {
			metricDataParams = append(metricDataParams, mdp)
			mdp = newMetricDataParam(startTime, endTime)
			// mdi = &cloudwatch.GetMetricDataInput{
			// 	StartTime: aws.Time(startTime),
			// 	EndTime:   aws.Time(endTime),
			// 	ScanBy:    aws.String("TimestampAscending"),
			// }
			noOfSearchExpressions = 0
		}

		mdp.CloudwatchQueries = append(mdp.CloudwatchQueries, query)
		mdp.MetricDataInput.MetricDataQueries = append(mdp.MetricDataInput.MetricDataQueries, metricDataQuery)

		if isSearchExpressions {
			noOfSearchExpressions++
		}
	}

	// metricDataInputs = append(metricDataInputs, mdi)
	metricDataParams = append(metricDataParams, mdp)

	return metricDataParams, nil
}

func (mdpb *metricDataParamBuilder) splitQueries(queries []*cloudWatchQuery) ([]*cloudWatchQuery, []*cloudWatchQuery) {
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

func (mdpb *metricDataParamBuilder) sortQueries(queries []*cloudWatchQuery) {
	sort.SliceStable(queries, func(i, j int) bool {
		return mdpb.getSortOrder(queries[i]) > mdpb.getSortOrder(queries[j])
	})
}

func (mdpb *metricDataParamBuilder) getSortOrder(query *cloudWatchQuery) int {
	if query.isMetricStat() {
		return 3
	} else if query.isMathExpression() {
		return 2
	}

	return 1
}
