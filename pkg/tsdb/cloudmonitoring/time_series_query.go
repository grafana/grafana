package cloudmonitoring

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/opentracing/opentracing-go"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

func (timeSeriesQuery cloudMonitoringTimeSeriesQuery) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo) (*backend.DataResponse, cloudMonitoringResponse, string, error) {
	dr := &backend.DataResponse{}
	projectName := timeSeriesQuery.ProjectName

	if projectName == "" {
		var err error
		projectName, err = s.getDefaultProject(ctx, dsInfo)
		if err != nil {
			dr.Error = err
			return dr, cloudMonitoringResponse{}, "", nil
		}
		slog.Info("No project name set on query, using project name from datasource", "projectName", projectName)
	}

	intervalCalculator := intervalv2.NewCalculator(intervalv2.CalculatorOptions{})
	interval := intervalCalculator.Calculate(req.Queries[0].TimeRange, time.Duration(timeSeriesQuery.IntervalMS/1000)*time.Second, req.Queries[0].MaxDataPoints)

	from := req.Queries[0].TimeRange.From
	to := req.Queries[0].TimeRange.To
	timeFormat := "2006/01/02-15:04:05"
	timeSeriesQuery.Query += fmt.Sprintf(" | graph_period %s | within d'%s', d'%s'", interval.Text, from.UTC().Format(timeFormat), to.UTC().Format(timeFormat))

	buf, err := json.Marshal(map[string]interface{}{
		"query": timeSeriesQuery.Query,
	})
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}
	r, err := s.createRequest(ctx, &dsInfo, path.Join("/v3/projects", projectName, "timeSeries:query"), bytes.NewBuffer(buf))
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}

	span, ctx := opentracing.StartSpanFromContext(ctx, "cloudMonitoring MQL query")
	span.SetTag("query", timeSeriesQuery.Query)
	span.SetTag("from", req.Queries[0].TimeRange.From)
	span.SetTag("until", req.Queries[0].TimeRange.To)

	defer span.Finish()

	if err := opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(r.Header)); err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}

	r = r.WithContext(ctx)
	res, err := dsInfo.services[cloudMonitor].client.Do(r)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}

	d, err := unmarshalResponse(res)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}

	return dr, d, timeSeriesQuery.Query, nil
}

func (timeSeriesQuery cloudMonitoringTimeSeriesQuery) parseResponse(queryRes *backend.DataResponse,
	response cloudMonitoringResponse, executedQueryString string) error {
	labels := make(map[string]map[string]bool)
	frames := data.Frames{}

	customFrameMeta := map[string]interface{}{}
	for _, series := range response.TimeSeriesData {
		seriesLabels := make(map[string]string)
		frame := data.NewFrameOfFieldTypes("", len(series.PointData), data.FieldTypeTime, data.FieldTypeFloat64)
		frame.RefID = timeSeriesQuery.RefID
		frame.Meta = &data.FrameMeta{
			ExecutedQueryString: executedQueryString,
		}

		for n, d := range response.TimeSeriesDescriptor.LabelDescriptors {
			key := toSnakeCase(d.Key)
			key = strings.Replace(key, ".", ".label.", 1)
			if _, ok := labels[key]; !ok {
				labels[key] = map[string]bool{}
			}

			labelValue := series.LabelValues[n]
			switch d.ValueType {
			case "BOOL":
				strVal := strconv.FormatBool(labelValue.BoolValue)
				labels[key][strVal] = true
				seriesLabels[key] = strVal
			case "INT64":
				labels[key][labelValue.Int64Value] = true
				seriesLabels[key] = labelValue.Int64Value
			default:
				labels[key][labelValue.StringValue] = true
				seriesLabels[key] = labelValue.StringValue
			}
		}

		for n, d := range response.TimeSeriesDescriptor.PointDescriptors {
			// If more than 1 pointdescriptor was returned, three aggregations are returned per time series - min, mean and max.
			// This is a because the period for the given table is less than half the duration which is used in the graph_period MQL function.
			// See https://cloud.google.com/monitoring/mql/reference#graph_period-tabop
			// When this is the case, we'll just ignore the min and max and use the mean value in the frame
			if len(response.TimeSeriesDescriptor.PointDescriptors) > 1 && !strings.HasSuffix(d.Key, ".mean") {
				continue
			}

			if _, ok := labels["metric.name"]; !ok {
				labels["metric.name"] = map[string]bool{}
			}
			labels["metric.name"][d.Key] = true
			seriesLabels["metric.name"] = d.Key
			defaultMetricName := d.Key

			// process non-distribution series
			if d.ValueType != "DISTRIBUTION" {
				// reverse the order to be ascending
				for i := len(series.PointData) - 1; i >= 0; i-- {
					point := series.PointData[i]
					value := point.Values[n].DoubleValue

					if d.ValueType == "INT64" {
						parsedValue, err := strconv.ParseFloat(point.Values[n].Int64Value, 64)
						if err == nil {
							value = parsedValue
						}
					} else if d.ValueType == "BOOL" {
						if point.Values[n].BoolValue {
							value = 1
						} else {
							value = 0
						}
					}

					frame.SetRow(len(series.PointData)-1-i, series.PointData[i].TimeInterval.EndTime, value)
				}

				metricName := formatLegendKeys(d.Key, defaultMetricName, seriesLabels, nil,
					&cloudMonitoringTimeSeriesFilter{
						ProjectName: timeSeriesQuery.ProjectName, AliasBy: timeSeriesQuery.AliasBy,
					})
				dataField := frame.Fields[1]
				dataField.Name = metricName
				dataField.Labels = seriesLabels
				setDisplayNameAsFieldName(dataField)

				frames = append(frames, frame)
				continue
			}

			// process distribution series
			buckets := make(map[int]*data.Frame)
			// reverse the order to be ascending
			for i := len(series.PointData) - 1; i >= 0; i-- {
				point := series.PointData[i]
				if len(point.Values[n].DistributionValue.BucketCounts) == 0 {
					continue
				}
				maxKey := 0
				for i := 0; i < len(point.Values[n].DistributionValue.BucketCounts); i++ {
					value, err := strconv.ParseFloat(point.Values[n].DistributionValue.BucketCounts[i], 64)
					if err != nil {
						continue
					}
					if _, ok := buckets[i]; !ok {
						// set lower bounds
						// https://cloud.google.com/monitoring/api/ref_v3/rest/v3/TimeSeries#Distribution
						bucketBound := calcBucketBound(point.Values[n].DistributionValue.BucketOptions, i)
						additionalLabels := map[string]string{"bucket": bucketBound}

						timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{})
						valueField := data.NewField(data.TimeSeriesValueFieldName, nil, []float64{})

						frameName := formatLegendKeys(d.Key, defaultMetricName, nil, additionalLabels, &cloudMonitoringTimeSeriesFilter{ProjectName: timeSeriesQuery.ProjectName, AliasBy: timeSeriesQuery.AliasBy})
						valueField.Name = frameName
						valueField.Labels = seriesLabels
						setDisplayNameAsFieldName(valueField)

						buckets[i] = &data.Frame{
							Name: frameName,
							Fields: []*data.Field{
								timeField,
								valueField,
							},
							RefID: timeSeriesQuery.RefID,
						}

						if maxKey < i {
							maxKey = i
						}
					}
					buckets[i].AppendRow(point.TimeInterval.EndTime, value)
				}

				// fill empty bucket
				for i := 0; i < maxKey; i++ {
					if _, ok := buckets[i]; !ok {
						bucketBound := calcBucketBound(point.Values[n].DistributionValue.BucketOptions, i)
						additionalLabels := data.Labels{"bucket": bucketBound}
						timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{})
						valueField := data.NewField(data.TimeSeriesValueFieldName, nil, []float64{})
						frameName := formatLegendKeys(d.Key, defaultMetricName, seriesLabels, additionalLabels, &cloudMonitoringTimeSeriesFilter{ProjectName: timeSeriesQuery.ProjectName, AliasBy: timeSeriesQuery.AliasBy})
						valueField.Name = frameName
						valueField.Labels = seriesLabels
						setDisplayNameAsFieldName(valueField)

						buckets[i] = &data.Frame{
							Name: frameName,
							Fields: []*data.Field{
								timeField,
								valueField,
							},
							RefID: timeSeriesQuery.RefID,
						}
					}
				}
			}
			for i := 0; i < len(buckets); i++ {
				frames = append(frames, buckets[i])
			}
		}
	}
	if len(response.TimeSeriesData) > 0 {
		dl := timeSeriesQuery.buildDeepLink()
		frames = addConfigData(frames, dl, response.Unit)
	}

	labelsByKey := make(map[string][]string)
	for key, values := range labels {
		for value := range values {
			labelsByKey[key] = append(labelsByKey[key], value)
		}
	}
	customFrameMeta["labels"] = labelsByKey

	for _, frame := range frames {
		if frame.Meta != nil {
			frame.Meta.Custom = customFrameMeta
		} else {
			frame.SetMeta(&data.FrameMeta{Custom: customFrameMeta})
		}
	}

	queryRes.Frames = frames

	return nil
}

func (timeSeriesQuery cloudMonitoringTimeSeriesQuery) parseToAnnotations(queryRes *backend.DataResponse,
	data cloudMonitoringResponse, title, text string) error {
	annotations := make([]map[string]string, 0)

	for _, series := range data.TimeSeriesData {
		metricLabels := make(map[string]string)
		resourceLabels := make(map[string]string)

		for n, d := range data.TimeSeriesDescriptor.LabelDescriptors {
			key := toSnakeCase(d.Key)
			labelValue := series.LabelValues[n]
			value := ""
			switch d.ValueType {
			case "BOOL":
				strVal := strconv.FormatBool(labelValue.BoolValue)
				value = strVal
			case "INT64":
				value = labelValue.Int64Value
			default:
				value = labelValue.StringValue
			}
			if strings.Index(key, "metric.") == 0 {
				key = key[len("metric."):]
				metricLabels[key] = value
			} else if strings.Index(key, "resource.") == 0 {
				key = key[len("resource."):]
				resourceLabels[key] = value
			}
		}

		for n, d := range data.TimeSeriesDescriptor.PointDescriptors {
			// reverse the order to be ascending
			for i := len(series.PointData) - 1; i >= 0; i-- {
				point := series.PointData[i]
				value := strconv.FormatFloat(point.Values[n].DoubleValue, 'f', 6, 64)
				if d.ValueType == "STRING" {
					value = point.Values[n].StringValue
				}
				annotation := make(map[string]string)
				annotation["time"] = point.TimeInterval.EndTime.UTC().Format(time.RFC3339)
				annotation["title"] = formatAnnotationText(title, value, d.MetricKind, metricLabels, resourceLabels)
				annotation["tags"] = ""
				annotation["text"] = formatAnnotationText(text, value, d.MetricKind, metricLabels, resourceLabels)
				annotations = append(annotations, annotation)
			}
		}
	}

	timeSeriesQuery.transformAnnotationToFrame(annotations, queryRes)
	return nil
}

func (timeSeriesQuery cloudMonitoringTimeSeriesQuery) buildDeepLink() string {
	u, err := url.Parse("https://console.cloud.google.com/monitoring/metrics-explorer")
	if err != nil {
		slog.Error("Failed to generate deep link: unable to parse metrics explorer URL", "projectName", timeSeriesQuery.ProjectName, "query", timeSeriesQuery.RefID)
		return ""
	}

	q := u.Query()
	q.Set("project", timeSeriesQuery.ProjectName)
	q.Set("Grafana_deeplink", "true")

	pageState := map[string]interface{}{
		"xyChart": map[string]interface{}{
			"constantLines": []string{},
			"dataSets": []map[string]interface{}{
				{
					"timeSeriesQuery": timeSeriesQuery.Query,
					"targetAxis":      "Y1",
					"plotType":        "LINE",
				},
			},
			"timeshiftDuration": "0s",
			"y1Axis": map[string]string{
				"label": "y1Axis",
				"scale": "LINEAR",
			},
		},
		"timeSelection": map[string]string{
			"timeRange": "custom",
			"start":     timeSeriesQuery.timeRange.From.Format(time.RFC3339Nano),
			"end":       timeSeriesQuery.timeRange.To.Format(time.RFC3339Nano),
		},
	}

	blob, err := json.Marshal(pageState)
	if err != nil {
		slog.Error("Failed to generate deep link", "pageState", pageState, "ProjectName", timeSeriesQuery.ProjectName, "query", timeSeriesQuery.RefID)
		return ""
	}

	q.Set("pageState", string(blob))
	u.RawQuery = q.Encode()

	accountChooserURL, err := url.Parse("https://accounts.google.com/AccountChooser")
	if err != nil {
		slog.Error("Failed to generate deep link: unable to parse account chooser URL", "ProjectName", timeSeriesQuery.ProjectName, "query", timeSeriesQuery.RefID)
		return ""
	}
	accountChooserQuery := accountChooserURL.Query()
	accountChooserQuery.Set("continue", u.String())
	accountChooserURL.RawQuery = accountChooserQuery.Encode()

	return accountChooserURL.String()
}

func (timeSeriesQuery cloudMonitoringTimeSeriesQuery) getRefID() string {
	return timeSeriesQuery.RefID
}
