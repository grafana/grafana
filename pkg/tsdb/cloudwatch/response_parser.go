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
	plog.Debug("Parsing metric data output", "queries", queries)
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
		plog.Debug("Handling metric data results", "id", id, "lr", lr)
		query := queries[id]
		frames, partialData, err := parseGetMetricDataTimeSeries(lr, labels[id], query)
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

func parseGetMetricDataTimeSeries(metricDataResults map[string]*cloudwatch.MetricDataResult, labels []string,
	query *cloudWatchQuery) (data.Frames, bool, error) {
	plog.Debug("Parsing metric data results", "results", metricDataResults)
	partialData := false
	frames := data.Frames{}
	for _, label := range labels {
		metricDataResult := metricDataResults[label]
		plog.Debug("Processing metric data result", "label", label, "statusCode", metricDataResult.StatusCode)
		if *metricDataResult.StatusCode != "Complete" {
			plog.Debug("Handling a partial result")
			partialData = true
		}

		for _, message := range metricDataResult.Messages {
			if *message.Code == "ArithmeticError" {
				return nil, false, fmt.Errorf("ArithmeticError in query %q: %s", query.RefId, *message.Value)
			}
		}

		// In case a multi-valued dimension is used and the cloudwatch query yields no values, create one empty time
		// series for each dimension value. Use that dimension value to expand the alias field
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
				tags := map[string]string{multiValuedDimension: value}
				for key, values := range query.Dimensions {
					if key != multiValuedDimension && len(values) > 0 {
						tags[key] = values[0]
					}
				}

				emptyFrame := data.Frame{
					Name: formatAlias(query, query.Stats, tags, label),
					Fields: []*data.Field{
						data.NewField("timestamp", nil, []float64{}),
						data.NewField("value", tags, []*float64{}),
					},
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
				plog.Debug("Handling dimension", "dimension", dim)
				values := query.Dimensions[dim]
				if len(values) == 1 && values[0] != "*" {
					plog.Debug("Got a tag value", "tag", dim, "value", values[0])
					tags[dim] = values[0]
				} else {
					for _, value := range values {
						if value == label || value == "*" {
							plog.Debug("Got a tag value", "tag", dim, "value", value, "label", label)
							tags[dim] = label
						} else if strings.Contains(label, value) {
							plog.Debug("Got a tag value", "tag", dim, "value", value, "label", label)
							tags[dim] = value
						}
					}
				}
			}

			timestamps := []float64{}
			points := []*float64{}
			for j, t := range metricDataResult.Timestamps {
				if j > 0 {
					expectedTimestamp := metricDataResult.Timestamps[j-1].Add(time.Duration(query.Period) * time.Second)
					if expectedTimestamp.Before(*t) {
						timestamps = append(timestamps, float64(expectedTimestamp.Unix()*1000))
						points = append(points, nil)
					}
				}
				val := metricDataResult.Values[j]
				plog.Debug("Handling timestamp", "timestamp", t, "value", *val)
				timestamps = append(timestamps, float64(t.Unix()*1000))
				points = append(points, val)
			}

			fields := []*data.Field{
				data.NewField("timestamp", nil, timestamps),
				data.NewField("value", tags, points),
			}
			frame := data.Frame{
				Name:   formatAlias(query, query.Stats, tags, label),
				Fields: fields,
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
