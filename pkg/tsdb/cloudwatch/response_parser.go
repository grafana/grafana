package cloudwatch

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

func (e *cloudWatchExecutor) parseResponse(startTime time.Time, endTime time.Time, metricDataOutputs []*cloudwatch.GetMetricDataOutput,
	queries []*models.CloudWatchQuery) ([]*responseWrapper, error) {
	aggregatedResponse := aggregateResponse(metricDataOutputs)
	queriesById := map[string]*models.CloudWatchQuery{}
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

func aggregateResponse(getMetricDataOutputs []*cloudwatch.GetMetricDataOutput) map[string]models.QueryRowResponse {
	responseByID := make(map[string]models.QueryRowResponse)
	errors := map[string]bool{
		models.MaxMetricsExceeded:         false,
		models.MaxQueryTimeRangeExceeded:  false,
		models.MaxQueryResultsExceeded:    false,
		models.MaxMatchingResultsExceeded: false,
	}
	// first check if any of the getMetricDataOutputs has any errors related to the request. if so, store the errors so they can be added to each query response
	for _, gmdo := range getMetricDataOutputs {
		for _, message := range gmdo.Messages {
			if _, exists := errors[*message.Code]; exists {
				errors[*message.Code] = true
			}
		}
	}
	for _, gmdo := range getMetricDataOutputs {
		for _, r := range gmdo.MetricDataResults {
			id := *r.Id

			response := models.NewQueryRowResponse(errors)
			if _, exists := responseByID[id]; exists {
				response = responseByID[id]
			}

			for _, message := range r.Messages {
				if *message.Code == "ArithmeticError" {
					response.AddArithmeticError(message.Value)
				}
			}

			response.AddMetricDataResult(r)
			responseByID[id] = response
		}
	}

	return responseByID
}

func getLabels(cloudwatchLabel string, query *models.CloudWatchQuery) data.Labels {
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

func buildDataFrames(startTime time.Time, endTime time.Time, aggregatedResponse models.QueryRowResponse,
	query *models.CloudWatchQuery) (data.Frames, error) {
	frames := data.Frames{}
	for _, metric := range aggregatedResponse.Metrics {
		label := *metric.Label

		deepLink, err := query.BuildDeepLink(startTime, endTime)
		if err != nil {
			return nil, err
		}

		// In case a multi-valued dimension is used and the cloudwatch query yields no values, create one empty time
		// series for each dimension value. Use that dimension value to expand the alias field
		if len(metric.Values) == 0 && query.IsMultiValuedDimensionExpression() {
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

				valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: label, Links: createDataLinks(deepLink)})

				emptyFrame := data.Frame{
					Name: label,
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
			val := metric.Values[j]
			timestamps = append(timestamps, t)
			points = append(points, val)
		}

		timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, timestamps)
		valueField := data.NewField(data.TimeSeriesValueFieldName, labels, points)

		valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: label, Links: createDataLinks(deepLink)})

		frame := data.Frame{
			Name: label,
			Fields: []*data.Field{
				timeField,
				valueField,
			},
			RefID: query.RefId,
			Meta:  createMeta(query),
		}

		for code := range aggregatedResponse.ErrorCodes {
			if aggregatedResponse.ErrorCodes[code] {
				frame.AppendNotices(data.Notice{
					Severity: data.NoticeSeverityWarning,
					Text:     "cloudwatch GetMetricData error: " + models.ErrorMessages[code],
				})
			}
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

func createMeta(query *models.CloudWatchQuery) *data.FrameMeta {
	return &data.FrameMeta{
		ExecutedQueryString: query.UsedExpression,
		Custom: fmt.Sprintf(`{
			"period": %d,
			"id":     %s,
		}`, query.Period, query.Id),
	}
}
