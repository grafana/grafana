package cloudwatch

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func (e *cloudWatchExecutor) parseResponse(metricDataOutputs []*cloudwatch.GetMetricDataOutput,
	queries map[string]*cloudWatchQuery) ([]*cloudwatchResponse, error) {
	// Map from result ID -> label -> result
	mdrs := make(map[string]map[string]*cloudwatch.MetricDataResult)
	labels := map[string][]string{}
	for _, mdo := range metricDataOutputs {
		requestExceededMaxLimit := false
		for _, message := range mdo.Messages {
			if *message.Code == "MaxMetricsExceeded" {
				requestExceededMaxLimit = true
			}
		}

		for _, r := range mdo.MetricDataResults {
			id := *r.Id
			label := *r.Label
			if _, exists := mdrs[id]; !exists {
				mdrs[id] = make(map[string]*cloudwatch.MetricDataResult)
				mdrs[id][label] = r
				labels[id] = append(labels[id], label)
			} else if _, exists := mdrs[id][label]; !exists {
				mdrs[id][label] = r
				labels[id] = append(labels[id], label)
			} else {
				mdr := mdrs[id][label]
				mdr.Timestamps = append(mdr.Timestamps, r.Timestamps...)
				mdr.Values = append(mdr.Values, r.Values...)
				if *r.StatusCode == "Complete" {
					mdr.StatusCode = r.StatusCode
				}
			}
			queries[id].RequestExceededMaxLimit = requestExceededMaxLimit
		}
	}

	cloudWatchResponses := make([]*cloudwatchResponse, 0)
	for id, lr := range mdrs {
		query := queries[id]
		frames, partialData, err := parseMetricResults(lr, labels[id], query)
		if err != nil {
			return nil, err
		}

		response := &cloudwatchResponse{
			DataFrames:              frames,
			Period:                  query.Period,
			Expression:              query.UsedExpression,
			RefId:                   query.RefId,
			Id:                      query.Id,
			RequestExceededMaxLimit: query.RequestExceededMaxLimit,
			PartialData:             partialData,
		}
		cloudWatchResponses = append(cloudWatchResponses, response)
	}

	return cloudWatchResponses, nil
}

func parseMetricResults(results map[string]*cloudwatch.MetricDataResult, labels []string,
	query *cloudWatchQuery) (data.Frames, bool, error) {
	partialData := false
	frames := data.Frames{}
	for _, label := range labels {
		result := results[label]
		if *result.StatusCode != "Complete" {
			partialData = true
		}

		for _, message := range result.Messages {
			if *message.Code == "ArithmeticError" {
				return nil, false, fmt.Errorf("ArithmeticError in query %q: %s", query.RefId, *message.Value)
			}
		}

		// In case a multi-valued dimension is used and the cloudwatch query yields no values, create one empty time
		// series for each dimension value. Use that dimension value to expand the alias field
		if len(result.Values) == 0 && query.isMultiValuedDimensionExpression() {
			series := 0
			multiValuedDimension := ""
			for key, values := range query.Dimensions {
				if len(values) > series {
					series = len(values)
					multiValuedDimension = key
				}
			}

			for _, value := range query.Dimensions[multiValuedDimension] {
				tags := map[string]string{multiValuedDimension: value}
				for key, values := range query.Dimensions {
					if key != multiValuedDimension && len(values) > 0 {
						tags[key] = values[0]
					}
				}

				timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, []*time.Time{})
				valueField := data.NewField(data.TimeSeriesValueFieldName, tags, []*float64{})

				frameName := formatAlias(query, query.Stats, tags, label)
				valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: frameName})

				emptyFrame := data.Frame{
					Name: frameName,
					Fields: []*data.Field{
						timeField,
						valueField,
					},
					RefID: query.RefId,
				}
				frames = append(frames, &emptyFrame)
			}
		} else {
			dims := make([]string, 0, len(query.Dimensions))
			for k := range query.Dimensions {
				dims = append(dims, k)
			}
			sort.Strings(dims)

			tags := data.Labels{}
			for _, dim := range dims {
				values := query.Dimensions[dim]
				if len(values) == 1 && values[0] != "*" {
					tags[dim] = values[0]
				} else {
					for _, value := range values {
						if value == label || value == "*" {
							tags[dim] = label
						} else if strings.Contains(label, value) {
							tags[dim] = value
						}
					}
				}
			}

			timestamps := []*time.Time{}
			points := []*float64{}
			for j, t := range result.Timestamps {
				if j > 0 {
					expectedTimestamp := result.Timestamps[j-1].Add(time.Duration(query.Period) * time.Second)
					if expectedTimestamp.Before(*t) {
						timestamps = append(timestamps, &expectedTimestamp)
						points = append(points, nil)
					}
				}
				val := result.Values[j]
				timestamps = append(timestamps, t)
				points = append(points, val)
			}

			timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, timestamps)
			valueField := data.NewField(data.TimeSeriesValueFieldName, tags, points)

			frameName := formatAlias(query, query.Stats, tags, label)
			valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: frameName})

			frame := data.Frame{
				Name: frameName,
				Fields: []*data.Field{
					timeField,
					valueField,
				},
				RefID: query.RefId,
			}
			frames = append(frames, &frame)
		}
	}

	return frames, partialData, nil
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

	data := map[string]string{
		"region":    region,
		"namespace": namespace,
		"metric":    metricName,
		"stat":      stat,
		"period":    period,
	}
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
