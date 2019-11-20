package cloudwatch

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *CloudWatchExecutor) parseResponse(metricDataOutputs []*cloudwatch.GetMetricDataOutput, queries map[string]*cloudWatchQuery) ([]*cloudwatchResponse, error) {
	mdr := make(map[string]map[string]*cloudwatch.MetricDataResult)

	for _, mdo := range metricDataOutputs {
		requestExceededMaxLimit := false
		for _, message := range mdo.Messages {
			if *message.Code == "MaxMetricsExceeded" {
				requestExceededMaxLimit = true
			}
		}

		for _, r := range mdo.MetricDataResults {
			if _, exists := mdr[*r.Id]; !exists {
				mdr[*r.Id] = make(map[string]*cloudwatch.MetricDataResult)
				mdr[*r.Id][*r.Label] = r
			} else if _, exists := mdr[*r.Id][*r.Label]; !exists {
				mdr[*r.Id][*r.Label] = r
			} else {
				mdr[*r.Id][*r.Label].Timestamps = append(mdr[*r.Id][*r.Label].Timestamps, r.Timestamps...)
				mdr[*r.Id][*r.Label].Values = append(mdr[*r.Id][*r.Label].Values, r.Values...)
				if *r.StatusCode == "Complete" {
					mdr[*r.Id][*r.Label].StatusCode = r.StatusCode
				}
			}
			queries[*r.Id].RequestExceededMaxLimit = requestExceededMaxLimit
		}
	}

	cloudWatchResponses := make([]*cloudwatchResponse, 0)
	for id, lr := range mdr {
		response := &cloudwatchResponse{}
		series, err := parseGetMetricDataTimeSeries(lr, queries[id])
		if err != nil {
			return cloudWatchResponses, err
		}

		response.series = series
		response.Expression = queries[id].UsedExpression
		response.RefId = queries[id].RefId
		response.Id = queries[id].Id
		response.RequestExceededMaxLimit = queries[id].RequestExceededMaxLimit

		cloudWatchResponses = append(cloudWatchResponses, response)
	}

	return cloudWatchResponses, nil
}

func parseGetMetricDataTimeSeries(metricDataResults map[string]*cloudwatch.MetricDataResult, query *cloudWatchQuery) (*tsdb.TimeSeriesSlice, error) {
	result := tsdb.TimeSeriesSlice{}
	for label, metricDataResult := range metricDataResults {
		if *metricDataResult.StatusCode != "Complete" {
			return nil, fmt.Errorf("too many datapoints requested in query %s. Please try to reduce the time range", query.RefId)
		}

		for _, message := range metricDataResult.Messages {
			if *message.Code == "ArithmeticError" {
				return nil, fmt.Errorf("ArithmeticError in query %s: %s", query.RefId, *message.Value)
			}
		}

		series := tsdb.TimeSeries{
			Tags:   make(map[string]string),
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

	if len(query.Alias) == 0 && query.isMathExpression() {
		return query.Id
	}

	if len(query.Alias) == 0 && query.isInferredSearchExpression() {
		return label
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
