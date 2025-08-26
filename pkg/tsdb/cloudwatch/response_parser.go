package cloudwatch

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

// matches a dynamic label
var dynamicLabel = regexp.MustCompile(`\$\{.+\}`)

func (ds *DataSource) parseResponse(ctx context.Context, metricDataOutputs []*cloudwatch.GetMetricDataOutput,
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

		if response.HasPermissionError {
			dataRes.Error = fmt.Errorf("PermissionError in query %q: %s", queryRow.RefId, response.PermissionErrorMessage)
		}

		var err error
		dataRes.Frames, err = buildDataFrames(ctx, response, queryRow)
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
				if *message.Code == "Forbidden" {
					response.AddPermissionError(message.Value)
				}
			}

			response.AddMetricDataResult(&r)
			responseByID[id] = response
		}
	}

	return responseByID
}

func parseLabels(cloudwatchLabel string, query *models.CloudWatchQuery) (string, data.Labels) {
	dims := make([]string, 0, len(query.Dimensions))
	for k := range query.Dimensions {
		dims = append(dims, k)
	}
	sort.Strings(dims)

	splitLabels := strings.Split(cloudwatchLabel, keySeparator)
	// The first part is the name of the time series, followed by the labels
	name := splitLabels[0]
	labelsIndex := 1

	// set Series to the name of the time series as a fallback
	labels := data.Labels{"Series": name}

	// do not parse labels for raw queries
	if query.MetricEditorMode == models.MetricEditorModeRaw {
		return name, labels
	}

	for _, dim := range dims {
		values := query.Dimensions[dim]
		if isSingleValue(values) {
			labels[dim] = values[0]
			continue
		}

		labels[dim] = splitLabels[labelsIndex]
		labelsIndex++
	}
	return name, labels
}

func getLabels(cloudwatchLabel string, query *models.CloudWatchQuery, addSeriesLabelAsFallback bool) data.Labels {
	dims := make([]string, 0, len(query.Dimensions))
	for k := range query.Dimensions {
		dims = append(dims, k)
	}
	sort.Strings(dims)
	labels := data.Labels{}

	if addSeriesLabelAsFallback {
		labels["Series"] = cloudwatchLabel
	}

	for _, dim := range dims {
		values := query.Dimensions[dim]
		if len(values) == 1 && values[0] != "*" {
			labels[dim] = values[0]
		} else if len(values) == 0 {
			// Metric Insights metrics might not have a value for a dimension specified in the `GROUP BY` clause for Metric Query type queries. When this happens, CloudWatch returns "Other" in the label for the dimension so `len(values)` would be 0.
			// We manually add "Other" as the value for the dimension to match what CloudWatch returns in the label.
			// See the note under `GROUP BY` in https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch-metrics-insights-querylanguage.html
			labels[dim] = "Other"
			continue
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

func buildDataFrames(ctx context.Context, aggregatedResponse models.QueryRowResponse,
	query *models.CloudWatchQuery) (data.Frames, error) {
	frames := data.Frames{}
	hasStaticLabel := query.Label != "" && !dynamicLabel.MatchString(query.Label)

	for _, metric := range aggregatedResponse.Metrics {
		label := *metric.Label

		deepLink, err := query.BuildDeepLink(query.StartTime, query.EndTime)
		if err != nil {
			return nil, err
		}

		// In case a multi-valued dimension is used and the cloudwatch query yields no values, create one empty time
		// series for each dimension value. Use that dimension value to expand the alias field
		if len(metric.Values) == 0 && query.IsMultiValuedDimensionExpression() {
			if features.IsEnabled(ctx, features.FlagCloudWatchNewLabelParsing) {
				label, _, _ = strings.Cut(label, keySeparator)
			}
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

		name := label
		var labels data.Labels
		if query.GetGetMetricDataAPIMode() == models.GMDApiModeSQLExpression {
			labels = getLabels(label, query, true)
		} else if features.IsEnabled(ctx, features.FlagCloudWatchNewLabelParsing) {
			name, labels = parseLabels(label, query)
		} else {
			labels = getLabels(label, query, false)
		}

		timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, metric.Timestamps)
		valueField := data.NewField(data.TimeSeriesValueFieldName, labels, metric.Values)

		// CloudWatch appends the dimensions to the returned label if the query label is not dynamic, so static labels need to be set
		if hasStaticLabel {
			name = query.Label
		}

		valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: name, Links: createDataLinks(deepLink)})
		frame := data.Frame{
			Name: name,
			Fields: []*data.Field{
				timeField,
				valueField,
			},
			RefID: query.RefId,
			Meta:  createMeta(query),
		}
		frame.Meta.Type = data.FrameTypeTimeSeriesMulti

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
