package cloudwatch

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func (e *cloudWatchExecutor) parseResponse(startTime time.Time, endTime time.Time, metricDataOutputs []*cloudwatch.GetMetricDataOutput,
	queries []*cloudWatchQuery) ([]*responseWrapper, error) {
	aggregatedResponse := aggregateResponse(metricDataOutputs)
	queriesById := map[string]*cloudWatchQuery{}
	for _, query := range queries {
		queriesById[query.Id] = query
	}

	results := []*responseWrapper{}
	for id, response := range aggregatedResponse {
		queryRow := queriesById[id]
		dataRes := backend.DataResponse{}

		if response.HasArithmeticError {
			dataRes.Error = fmt.Errorf("ArithmeticError in query %q: %s", queryRow.RefId, response.ArithmeticErrorMessage)
		}

		var err error
		dataRes.Frames, err = buildDataFrames(startTime, endTime, response, queryRow)
		if err != nil {
			return nil, err
		}

		results = append(results, &responseWrapper{
			DataResponse: &dataRes,
			RefId:        queryRow.RefId,
		})
	}

	return results, nil
}

func aggregateResponse(getMetricDataOutputs []*cloudwatch.GetMetricDataOutput) map[string]queryRowResponse {
	responseByID := make(map[string]queryRowResponse)
	for _, gmdo := range getMetricDataOutputs {
		requestExceededMaxLimit := false
		for _, message := range gmdo.Messages {
			if *message.Code == "MaxMetricsExceeded" {
				requestExceededMaxLimit = true
			}
		}
		for _, r := range gmdo.MetricDataResults {
			id := *r.Id
			label := *r.Label

			response := newQueryRowResponse(id)
			if _, exists := responseByID[id]; exists {
				response = responseByID[id]
			}

			for _, message := range r.Messages {
				if *message.Code == "ArithmeticError" {
					response.addArithmeticError(message.Value)
				}
			}

			if _, exists := response.Metrics[label]; !exists {
				response.addMetricDataResult(r)
			} else {
				response.appendTimeSeries(r)
			}

			response.RequestExceededMaxLimit = response.RequestExceededMaxLimit || requestExceededMaxLimit
			responseByID[id] = response
		}
	}

	return responseByID
}

func getLabels(cloudwatchLabel string, query *cloudWatchQuery) data.Labels {
	dims := make([]string, 0, len(query.Dimensions))
	for k := range query.Dimensions {
		dims = append(dims, k)
	}
	sort.Strings(dims)
	labels := data.Labels{}
	for _, dim := range dims {
		values := query.Dimensions[dim]
		if len(values) == 1 && values[0] != "*" {
			labels[dim] = values[0]
		} else {
			for _, value := range values {
				if value == cloudwatchLabel || value == "*" {
					labels[dim] = cloudwatchLabel
				} else if strings.Contains(cloudwatchLabel, value) {
					labels[dim] = value
				}
			}
		}
	}
	return labels
}

func buildDataFrames(startTime time.Time, endTime time.Time, aggregatedResponse queryRowResponse,
	query *cloudWatchQuery) (data.Frames, error) {
	frames := data.Frames{}
	for _, label := range aggregatedResponse.Labels {
		metric := aggregatedResponse.Metrics[label]

		deepLink, err := query.buildDeepLink(startTime, endTime)
		if err != nil {
			return nil, err
		}

		// In case a multi-valued dimension is used and the cloudwatch query yields no values, create one empty time
		// series for each dimension value. Use that dimension value to expand the alias field
		if len(metric.Values) == 0 && query.isMultiValuedDimensionExpression() {
			series := 0
			multiValuedDimension := ""
			for key, values := range query.Dimensions {
				if len(values) > series {
					series = len(values)
					multiValuedDimension = key
				}
			}

			for _, value := range query.Dimensions[multiValuedDimension] {
				labels := map[string]string{multiValuedDimension: value}
				for key, values := range query.Dimensions {
					if key != multiValuedDimension && len(values) > 0 {
						labels[key] = values[0]
					}
				}

				timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, []*time.Time{})
				valueField := data.NewField(data.TimeSeriesValueFieldName, labels, []*float64{})

				frameName := formatAlias(query, query.Statistic, labels, label)
				valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: frameName, Links: createDataLinks(deepLink)})

				emptyFrame := data.Frame{
					Name: frameName,
					Fields: []*data.Field{
						timeField,
						valueField,
					},
					RefID: query.RefId,
					Meta:  createMeta(query),
				}
				frames = append(frames, &emptyFrame)
			}
			continue
		}

		labels := getLabels(label, query)
		timestamps := []*time.Time{}
		points := []*float64{}
		for j, t := range metric.Timestamps {
			if j > 0 {
				expectedTimestamp := metric.Timestamps[j-1].Add(time.Duration(query.Period) * time.Second)
				if expectedTimestamp.Before(*t) {
					timestamps = append(timestamps, &expectedTimestamp)
					points = append(points, nil)
				}
			}
			val := metric.Values[j]
			timestamps = append(timestamps, t)
			points = append(points, val)
		}

		timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, timestamps)
		valueField := data.NewField(data.TimeSeriesValueFieldName, labels, points)

		frameName := formatAlias(query, query.Statistic, labels, label)
		valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: frameName, Links: createDataLinks(deepLink)})

		frame := data.Frame{
			Name: frameName,
			Fields: []*data.Field{
				timeField,
				valueField,
			},
			RefID: query.RefId,
			Meta:  createMeta(query),
		}

		if aggregatedResponse.RequestExceededMaxLimit {
			frame.AppendNotices(data.Notice{
				Severity: data.NoticeSeverityWarning,
				Text:     "cloudwatch GetMetricData error: Maximum number of allowed metrics exceeded. Your search may have been limited",
			})
		}

		if aggregatedResponse.StatusCode != "Complete" {
			frame.AppendNotices(data.Notice{
				Severity: data.NoticeSeverityWarning,
				Text:     "cloudwatch GetMetricData error: Too many datapoints requested - your search has been limited. Please try to reduce the time range",
			})
		}

		frames = append(frames, &frame)
	}

	return frames, nil
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

func createDataLinks(link string) []data.DataLink {
	dataLinks := []data.DataLink{}
	if link != "" {
		dataLinks = append(dataLinks, data.DataLink{
			Title:       "View in CloudWatch console",
			TargetBlank: true,
			URL:         link,
		})
	}
	return dataLinks
}

func createMeta(query *cloudWatchQuery) *data.FrameMeta {
	return &data.FrameMeta{
		ExecutedQueryString: query.UsedExpression,
		Custom: simplejson.NewFromAny(map[string]interface{}{
			"period": query.Period,
			"id":     query.Id,
		}),
	}
}
