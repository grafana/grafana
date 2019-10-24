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

func (e *CloudWatchExecutor) parseResponse(metricDataResults []*cloudwatch.MetricDataResult, queries []*cloudWatchQuery) ([]*tsdb.QueryResult, error) {
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
		queryMessages := []*cloudwatch.MessageData{}
		timeSeries := make(tsdb.TimeSeriesSlice, 0)
		for i, stat := range query.Statistics {
			lr := mdr[getQueryID(query, i)]
			series, messages, err := parseGetMetricDataTimeSeries(lr, query, *stat)
			queryMessages = append(queryMessages, messages...)
			if err != nil {
				return queryResponses, err
			}
			timeSeries = append(timeSeries, *series...)
			queryRes.Meta.Set("searchExpressions", query.SearchExpressions)
		}
		sort.Slice(timeSeries, func(i, j int) bool {
			return timeSeries[i].Name < timeSeries[j].Name
		})
		queryRes.Series = timeSeries
		for _, message := range queryMessages {
			plog.Info("QueryResponseMessage", "", message.Value)
		}

		queryResponses = append(queryResponses, queryRes)
	}

	return queryResponses, nil
}

func parseGetMetricDataTimeSeries(lr map[string]*cloudwatch.MetricDataResult, query *cloudWatchQuery, stat string) (*tsdb.TimeSeriesSlice, []*cloudwatch.MessageData, error) {
	result := tsdb.TimeSeriesSlice{}
	messages := []*cloudwatch.MessageData{}
	for label, r := range lr {
		if *r.StatusCode != "Complete" {
			return &result, messages, fmt.Errorf("Part of query is failed: %s", *r.StatusCode)
		}

		messages = append(messages, r.Messages...)

		series := tsdb.TimeSeries{
			Tags:   map[string]string{},
			Points: make([]tsdb.TimePoint, 0),
		}

		for key, values := range query.Dimensions {
			for _, value := range values {
				if value == label || value == "*" {
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
	return &result, messages, nil
}

func formatAlias(query *cloudWatchQuery, stat string, dimensions map[string]string, label string) string {
	region := query.Region
	namespace := query.Namespace
	metricName := query.MetricName
	period := strconv.Itoa(query.Period)
	if len(query.Id) > 0 && len(query.Expression) > 0 {
		if strings.Index(query.Expression, "SEARCH(") == 0 {
			pIndex := strings.LastIndex(query.Expression, ",")
			period = strings.Trim(query.Expression[pIndex+1:], " )")
			sIndex := strings.LastIndex(query.Expression[:pIndex], ",")
			stat = strings.Trim(query.Expression[sIndex+1:pIndex], " '")
		} else if len(query.Alias) > 0 {
			// expand by Alias
		} else {
			return query.Id
		}
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
