package cloudwatch

import (
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *CloudWatchExecutor) parseResponse(metricDataResults []*cloudwatch.MetricDataResult, queries []*CloudWatchQuery) ([]*tsdb.QueryResult, error) {
	queryResponses := make([]*tsdb.QueryResult, 0)

	mdr := make(map[string]map[string]*cloudwatch.MetricDataResult)
	for _, r := range metricDataResults {
		if _, ok := mdr[*r.Id]; !ok {
			mdr[*r.Id] = make(map[string]*cloudwatch.MetricDataResult)
			mdr[*r.Id][*r.Label] = r
		} else if _, ok := mdr[*r.Id][*r.Label]; !ok {
			mdr[*r.Id][*r.Label] = r
		} else {
			mdr[*r.Id][*r.Label].Timestamps = append(mdr[*r.Id][*r.Label].Timestamps, r.Timestamps...)
			mdr[*r.Id][*r.Label].Values = append(mdr[*r.Id][*r.Label].Values, r.Values...)
		}
	}

	for _, query := range queries {
		queryRes := tsdb.NewQueryResult()
		queryRes.RefId = query.RefId
		queryRes.Meta = simplejson.New()
		for i, stat := range query.Statistics {
			lr := mdr[getQueryID(query, i)]
			series, err := parseGetMetricDataTimeSeries(lr, query, *stat)
			if err != nil {
				return queryResponses, err
			}
			queryRes.Series = append(queryRes.Series, *series...)
			queryRes.Meta.Set("searchExpressions", query.SearchExpressions)

		}
		queryResponses = append(queryResponses, queryRes)
	}

	return queryResponses, nil
}

func parseGetMetricDataTimeSeries(lr map[string]*cloudwatch.MetricDataResult, query *CloudWatchQuery, stat string) (*tsdb.TimeSeriesSlice, error) {
	result := tsdb.TimeSeriesSlice{}
	for label, r := range lr {
		if *r.StatusCode != "Complete" {
			return &result, fmt.Errorf("Part of query is failed: %s", *r.StatusCode)
		}

		series := tsdb.TimeSeries{
			Tags:   map[string]string{},
			Points: make([]tsdb.TimePoint, 0),
		}

		for key, values := range query.Dimensions {
			for _, value := range values {
				if value == label {
					series.Tags[key] = label
				}
			}
		}

		series.Name = formatAlias(query, stat, series.Tags, label)

		for j, t := range r.Timestamps {
			if j > 0 {
				expectedTimestamp := r.Timestamps[j-1].Add(time.Duration(query.Period) * time.Second)
				if expectedTimestamp.Before(*t) {
					series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), float64(expectedTimestamp.Unix()*1000)))
				}
			}
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(*r.Values[j]), float64((*t).Unix())*1000))
		}
		result = append(result, &series)
	}
	return &result, nil
}
