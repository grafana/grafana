package cloudwatch

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *CloudWatchExecutor) parseResponse(metricDataOutputs []*cloudwatch.GetMetricDataOutput, queries map[string]*cloudWatchQuery) (map[string]*tsdb.QueryResult, error) {
	queryResponses := make(map[string]*tsdb.QueryResult, 0)
	mdr := make(map[string]map[string]*cloudwatch.MetricDataResult)

	for _, mdo := range metricDataOutputs {
		requestExceededMaxLimit := false
		for _, message := range mdo.Messages {
			if *message.Code == "MaxMetricsExceeded" {
				requestExceededMaxLimit = true
			}
		}

		for _, r := range mdo.MetricDataResults {
			if _, ok := mdr[*r.Id]; !ok {
				mdr[*r.Id] = make(map[string]*cloudwatch.MetricDataResult)
				mdr[*r.Id][*r.Label] = r
			} else if _, ok := mdr[*r.Id][*r.Label]; !ok {
				mdr[*r.Id][*r.Label] = r
			} else {
				mdr[*r.Id][*r.Label].Timestamps = append(mdr[*r.Id][*r.Label].Timestamps, r.Timestamps...)
				mdr[*r.Id][*r.Label].Values = append(mdr[*r.Id][*r.Label].Values, r.Values...)
			}

			queries[*r.Id].RequestExceededMaxLimit = requestExceededMaxLimit
		}
	}

	queriesByRefID := make(map[string][]*cloudWatchQuery, 0)
	for _, query := range queries {
		if _, ok := queriesByRefID[query.RefId]; !ok {
			queriesByRefID[query.RefId] = []*cloudWatchQuery{query}
		} else {
			queriesByRefID[query.RefId] = append(queriesByRefID[query.RefId], query)
		}
	}

	for refID, queries := range queriesByRefID {
		queryResponses[refID] = tsdb.NewQueryResult()
		queryResponses[refID].RefId = refID
		queryResponses[refID].Meta = simplejson.New()
		queryResponses[refID].Series = tsdb.TimeSeriesSlice{}
		timeSeries := make(tsdb.TimeSeriesSlice, 0)

		searchExpressions := []string{}
		requestExceededMaxLimit := false
		for _, query := range queries {
			series, err := parseGetMetricDataTimeSeries(mdr[query.Id], query)
			if err != nil {
				return queryResponses, err
			}

			timeSeries = append(timeSeries, *series...)
			requestExceededMaxLimit = requestExceededMaxLimit || query.RequestExceededMaxLimit
			if len(query.SearchExpression) > 0 {
				searchExpressions = append(searchExpressions, query.SearchExpression)
			}
		}

		sort.Slice(timeSeries, func(i, j int) bool {
			return timeSeries[i].Name < timeSeries[j].Name
		})

		if requestExceededMaxLimit {
			queryResponses[refID].ErrorString = "Cloudwatch GetMetricData error: Maximum number of allowed metrics exceeded. Your search may have been limited."
		}
		queryResponses[refID].Series = timeSeries
		queryResponses[refID].Meta.Set("searchExpressions", searchExpressions)
	}

	return queryResponses, nil
}

func parseGetMetricDataTimeSeries(metricDataResults map[string]*cloudwatch.MetricDataResult, query *cloudWatchQuery) (*tsdb.TimeSeriesSlice, error) {
	result := tsdb.TimeSeriesSlice{}
	for label, metricDataResult := range metricDataResults {
		if *metricDataResult.StatusCode != "Complete" {
			return &result, fmt.Errorf("Part of query failed: %s", *metricDataResult.StatusCode)
		}

		for _, message := range metricDataResult.Messages {
			plog.Info("ArithmeticError", *message.Code, *message.Value)
			if *message.Code == "ArithmeticError" {
				return &result, fmt.Errorf("ArithmeticError in query %s: %s", query.RefId, *message.Value)
			}
		}

		series := tsdb.TimeSeries{
			Tags:   map[string]string{},
			Points: make([]tsdb.TimePoint, 0),
		}

		for key, values := range query.Dimensions {
			if len(values) == 1 && values[0] != "*" {
				series.Tags[key] = values[0]
			} else {
				for _, value := range values {
					if value == label || value == "*" {
						series.Tags[key] = label
					}
				}
			}
		}

		series.Name = formatAlias(query, query.Stats, series.Tags, label)

		for j, t := range metricDataResult.Timestamps {
			if j > 0 {
				expectedTimestamp := metricDataResult.Timestamps[j-1].Add(time.Duration(query.Period) * time.Second)
				if expectedTimestamp.Before(*t) {
					series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFromPtr(nil), float64(expectedTimestamp.Unix()*1000)))
				}
			}
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(*metricDataResult.Values[j]), float64((*t).Unix())*1000))
		}
		result = append(result, &series)
	}
	return &result, nil
}

func formatAlias(query *cloudWatchQuery, stat string, dimensions map[string]string, label string) string {
	region := query.Region
	namespace := query.Namespace
	metricName := query.MetricName
	period := strconv.Itoa(query.Period)

	if query.isUserDefinedSearchExpression() {
		pIndex := strings.LastIndex(query.Expression, ",")
		period = strings.Trim(query.Expression[pIndex+1:], " )")
		sIndex := strings.LastIndex(query.Expression[:pIndex], ",")
		stat = strings.Trim(query.Expression[sIndex+1:pIndex], " '")
	}

	if query.isMathExpression() && len(query.Alias) == 0 {
		return query.Id
	}

	data := map[string]string{}
	data["region"] = region
	data["namespace"] = namespace
	data["metric"] = metricName
	data["stat"] = stat
	data["period"] = period
	if len(label) != 0 {
		data["label"] = label
	}
	for k, v := range dimensions {
		data[k] = v
	}

	result := aliasFormat.ReplaceAllFunc([]byte(query.Alias), func(in []byte) []byte {
		labelName := strings.Replace(string(in), "{{", "", 1)
		labelName = strings.Replace(labelName, "}}", "", 1)
		labelName = strings.TrimSpace(labelName)
		if val, exists := data[labelName]; exists {
			return []byte(val)
		}

		return in
	})

	if string(result) == "" {
		return metricName + "_" + stat
	}

	return string(result)
}
