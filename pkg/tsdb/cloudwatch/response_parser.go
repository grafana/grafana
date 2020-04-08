package cloudwatch

import (
	"fmt"
	"sort"
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
		series, partialData, err := parseGetMetricDataTimeSeries(lr, queries[id])
		if err != nil {
			return cloudWatchResponses, err
		}

		response.series = series
		response.Period = queries[id].Period
		response.Expression = queries[id].UsedExpression
		response.RefId = queries[id].RefId
		response.Id = queries[id].Id
		response.RequestExceededMaxLimit = queries[id].RequestExceededMaxLimit
		response.PartialData = partialData

		cloudWatchResponses = append(cloudWatchResponses, response)
	}

	return cloudWatchResponses, nil
}

func parseGetMetricDataTimeSeries(metricDataResults map[string]*cloudwatch.MetricDataResult, query *cloudWatchQuery) (*tsdb.TimeSeriesSlice, bool, error) {
	result := tsdb.TimeSeriesSlice{}
	partialData := false
	metricDataResultLabels := make([]string, 0)
	for k := range metricDataResults {
		metricDataResultLabels = append(metricDataResultLabels, k)
	}
	sort.Strings(metricDataResultLabels)

	for _, label := range metricDataResultLabels {
		metricDataResult := metricDataResults[label]
		if *metricDataResult.StatusCode != "Complete" {
			partialData = true
		}

		for _, message := range metricDataResult.Messages {
			if *message.Code == "ArithmeticError" {
				return nil, false, fmt.Errorf("ArithmeticError in query %s: %s", query.RefId, *message.Value)
			}
		}

		// In case a multi-valued dimension is used and the cloudwatch query yields no values, create one empty time series for each dimension value.
		// Use that dimension value to expand the alias field
		if len(metricDataResult.Values) == 0 && query.isMultiValuedDimensionExpression() {
			series := 0
			multiValuedDimension := ""
			for key, values := range query.Dimensions {
				if len(values) > series {
					series = len(values)
					multiValuedDimension = key
				}
			}

			for _, value := range query.Dimensions[multiValuedDimension] {
				emptySeries := tsdb.TimeSeries{
					Tags:   map[string]string{multiValuedDimension: value},
					Points: make([]tsdb.TimePoint, 0),
				}
				for key, values := range query.Dimensions {
					if key != multiValuedDimension && len(values) > 0 {
						emptySeries.Tags[key] = values[0]
					}
				}

				emptySeries.Name = formatAlias(query, query.Stats, emptySeries.Tags, label)
				result = append(result, &emptySeries)
			}
		} else {
			keys := make([]string, 0)
			for k := range query.Dimensions {
				keys = append(keys, k)
			}
			sort.Strings(keys)

			series := tsdb.TimeSeries{
				Tags:   make(map[string]string),
				Points: make([]tsdb.TimePoint, 0),
			}

			for _, key := range keys {
				values := query.Dimensions[key]
				if len(values) == 1 && values[0] != "*" {
					series.Tags[key] = values[0]
				} else {
					for _, value := range values {
						if value == label || value == "*" {
							series.Tags[key] = label
						} else if strings.Contains(label, value) {
							series.Tags[key] = value
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
	}
	return &result, partialData, nil
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

	if len(query.Alias) == 0 && query.isInferredSearchExpression() && !query.isMultiValuedDimensionExpression() {
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
