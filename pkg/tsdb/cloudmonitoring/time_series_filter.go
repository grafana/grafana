package cloudmonitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/opentracing/opentracing-go"
)

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo) (*backend.DataResponse, cloudMonitoringResponse, string, error) {
	dr := &backend.DataResponse{}
	projectName := timeSeriesFilter.ProjectName
	if projectName == "" {
		var err error
		projectName, err = s.getDefaultProject(ctx, dsInfo)
		if err != nil {
			dr.Error = err
			return dr, cloudMonitoringResponse{}, "", nil
		}
		slog.Info("No project name set on query, using project name from datasource", "projectName", projectName)
	}

	r, err := s.createRequest(ctx, &dsInfo, path.Join("/v3/projects", projectName, "timeSeries"), nil)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}

	r.URL.RawQuery = timeSeriesFilter.Params.Encode()
	alignmentPeriod, ok := r.URL.Query()["aggregation.alignmentPeriod"]

	if ok {
		seconds, err := strconv.ParseInt(alignmentPeriodRe.FindString(alignmentPeriod[0]), 10, 64)
		if err == nil {
			if len(dr.Frames) == 0 {
				dr.Frames = append(dr.Frames, data.NewFrame(""))
			}
			firstFrame := dr.Frames[0]
			if firstFrame.Meta == nil {
				firstFrame.SetMeta(&data.FrameMeta{
					Custom: map[string]interface{}{
						"alignmentPeriod": seconds,
					},
				})
			}
		}
	}

	span, ctx := opentracing.StartSpanFromContext(ctx, "cloudMonitoring query")
	span.SetTag("target", timeSeriesFilter.Target)
	span.SetTag("from", req.Queries[0].TimeRange.From)
	span.SetTag("until", req.Queries[0].TimeRange.To)
	span.SetTag("datasource_id", dsInfo.id)
	span.SetTag("org_id", req.PluginContext.OrgID)

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

	return dr, d, r.URL.RawQuery, nil
}

//nolint: gocyclo
func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) parseResponse(queryRes *backend.DataResponse,
	response cloudMonitoringResponse, executedQueryString string) error {
	labels := make(map[string]map[string]bool)
	frames := data.Frames{}

	customFrameMeta := map[string]interface{}{}
	customFrameMeta["alignmentPeriod"] = timeSeriesFilter.Params.Get("aggregation.alignmentPeriod")
	customFrameMeta["perSeriesAligner"] = timeSeriesFilter.Params.Get("aggregation.perSeriesAligner")
	for _, series := range response.TimeSeries {
		seriesLabels := data.Labels{}
		defaultMetricName := series.Metric.Type
		labels["resource.type"] = map[string]bool{series.Resource.Type: true}
		seriesLabels["resource.type"] = series.Resource.Type

		frame := data.NewFrameOfFieldTypes("", len(series.Points), data.FieldTypeTime, data.FieldTypeFloat64)
		frame.RefID = timeSeriesFilter.RefID
		frame.Meta = &data.FrameMeta{
			ExecutedQueryString: executedQueryString,
		}

		for key, value := range series.Metric.Labels {
			if _, ok := labels["metric.label."+key]; !ok {
				labels["metric.label."+key] = map[string]bool{}
			}
			labels["metric.label."+key][value] = true
			seriesLabels["metric.label."+key] = value

			if len(timeSeriesFilter.GroupBys) == 0 || containsLabel(timeSeriesFilter.GroupBys, "metric.label."+key) {
				defaultMetricName += " " + value
			}
		}

		for key, value := range series.Resource.Labels {
			if _, ok := labels["resource.label."+key]; !ok {
				labels["resource.label."+key] = map[string]bool{}
			}
			labels["resource.label."+key][value] = true
			seriesLabels["resource.label."+key] = value

			if containsLabel(timeSeriesFilter.GroupBys, "resource.label."+key) {
				defaultMetricName += " " + value
			}
		}

		for labelType, labelTypeValues := range series.MetaData {
			for labelKey, labelValue := range labelTypeValues {
				key := toSnakeCase(fmt.Sprintf("metadata.%s.%s", labelType, labelKey))
				if _, ok := labels[key]; !ok {
					labels[key] = map[string]bool{}
				}

				switch v := labelValue.(type) {
				case string:
					labels[key][v] = true
					seriesLabels[key] = v
				case bool:
					strVal := strconv.FormatBool(v)
					labels[key][strVal] = true
					seriesLabels[key] = strVal
				case []interface{}:
					for _, v := range v {
						strVal := v.(string)
						labels[key][strVal] = true
						if len(seriesLabels[key]) > 0 {
							strVal = fmt.Sprintf("%s, %s", seriesLabels[key], strVal)
						}
						seriesLabels[key] = strVal
					}
				}
			}
		}

		// reverse the order to be ascending
		if series.ValueType != "DISTRIBUTION" {
			timeSeriesFilter.handleNonDistributionSeries(series, defaultMetricName, seriesLabels, frame)
			frames = append(frames, frame)
			continue
		}
		buckets := make(map[int]*data.Frame)
		for i := len(series.Points) - 1; i >= 0; i-- {
			point := series.Points[i]
			if len(point.Value.DistributionValue.BucketCounts) == 0 {
				continue
			}
			maxKey := 0
			for i := 0; i < len(point.Value.DistributionValue.BucketCounts); i++ {
				value, err := strconv.ParseFloat(point.Value.DistributionValue.BucketCounts[i], 64)
				if err != nil {
					continue
				}
				if _, ok := buckets[i]; !ok {
					// set lower bounds
					// https://cloud.google.com/monitoring/api/ref_v3/rest/v3/TimeSeries#Distribution
					bucketBound := calcBucketBound(point.Value.DistributionValue.BucketOptions, i)
					additionalLabels := map[string]string{"bucket": bucketBound}

					timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{})
					valueField := data.NewField(data.TimeSeriesValueFieldName, nil, []float64{})

					frameName := formatLegendKeys(series.Metric.Type, defaultMetricName, nil, additionalLabels, timeSeriesFilter)
					valueField.Name = frameName
					valueField.Labels = seriesLabels
					setDisplayNameAsFieldName(valueField)

					buckets[i] = &data.Frame{
						Name: frameName,
						Fields: []*data.Field{
							timeField,
							valueField,
						},
						RefID: timeSeriesFilter.RefID,
					}

					if maxKey < i {
						maxKey = i
					}
				}
				buckets[i].AppendRow(point.Interval.EndTime, value)
			}
			for i := 0; i < maxKey; i++ {
				if _, ok := buckets[i]; !ok {
					bucketBound := calcBucketBound(point.Value.DistributionValue.BucketOptions, i)
					additionalLabels := data.Labels{"bucket": bucketBound}
					timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{})
					valueField := data.NewField(data.TimeSeriesValueFieldName, nil, []float64{})
					frameName := formatLegendKeys(series.Metric.Type, defaultMetricName, seriesLabels,
						additionalLabels, timeSeriesFilter)
					valueField.Name = frameName
					valueField.Labels = seriesLabels
					setDisplayNameAsFieldName(valueField)

					buckets[i] = &data.Frame{
						Name:  frameName,
						RefID: timeSeriesFilter.RefID,
						Fields: []*data.Field{
							timeField,
							valueField,
						},
					}
				}
			}
		}
		for i := 0; i < len(buckets); i++ {
			frames = append(frames, buckets[i])
		}
	}
	if len(response.TimeSeries) > 0 {
		dl := timeSeriesFilter.buildDeepLink()
		frames = addConfigData(frames, dl, response.Unit)
	}

	labelsByKey := make(map[string][]string)
	for key, values := range labels {
		for value := range values {
			labelsByKey[key] = append(labelsByKey[key], value)
		}
	}
	customFrameMeta["labels"] = labelsByKey
	customFrameMeta["groupBys"] = timeSeriesFilter.GroupBys

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

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) handleNonDistributionSeries(series timeSeries,
	defaultMetricName string, seriesLabels map[string]string, frame *data.Frame) {
	for i := 0; i < len(series.Points); i++ {
		point := series.Points[i]
		value := point.Value.DoubleValue

		if series.ValueType == "INT64" {
			parsedValue, err := strconv.ParseFloat(point.Value.IntValue, 64)
			if err == nil {
				value = parsedValue
			}
		}

		if series.ValueType == "BOOL" {
			if point.Value.BoolValue {
				value = 1
			} else {
				value = 0
			}
		}
		frame.SetRow(len(series.Points)-1-i, point.Interval.EndTime, value)
	}

	metricName := formatLegendKeys(series.Metric.Type, defaultMetricName, seriesLabels, nil, timeSeriesFilter)
	dataField := frame.Fields[1]
	dataField.Name = metricName
	dataField.Labels = seriesLabels
	setDisplayNameAsFieldName(dataField)
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) parseToAnnotations(dr *backend.DataResponse,
	response cloudMonitoringResponse, title, text string) error {
	frames := data.Frames{}
	for _, series := range response.TimeSeries {
		if len(series.Points) == 0 {
			continue
		}
		annotation := make(map[string][]string)
		for i := len(series.Points) - 1; i >= 0; i-- {
			point := series.Points[i]
			value := strconv.FormatFloat(point.Value.DoubleValue, 'f', 6, 64)
			if series.ValueType == "STRING" {
				value = point.Value.StringValue
			}
			annotation["time"] = append(annotation["time"], point.Interval.EndTime.UTC().Format(time.RFC3339))
			annotation["title"] = append(annotation["title"], formatAnnotationText(title, value, series.Metric.Type,
				series.Metric.Labels, series.Resource.Labels))
			annotation["tags"] = append(annotation["tags"], "")
			annotation["text"] = append(annotation["text"], formatAnnotationText(text, value, series.Metric.Type,
				series.Metric.Labels, series.Resource.Labels))
		}
		frames = append(frames, data.NewFrame(timeSeriesFilter.getRefID(),
			data.NewField("time", nil, annotation["time"]),
			data.NewField("title", nil, annotation["title"]),
			data.NewField("tags", nil, annotation["tags"]),
			data.NewField("text", nil, annotation["text"]),
		))
	}
	dr.Frames = frames

	return nil
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) buildDeepLink() string {
	if timeSeriesFilter.Slo != "" {
		return ""
	}

	filter := timeSeriesFilter.Params.Get("filter")
	if !strings.Contains(filter, "resource.type=") {
		resourceType := timeSeriesFilter.Params.Get("resourceType")
		if resourceType != "" {
			filter = fmt.Sprintf(`resource.type="%s" %s`, resourceType, filter)
		}
	}

	u, err := url.Parse("https://console.cloud.google.com/monitoring/metrics-explorer")
	if err != nil {
		slog.Error("Failed to generate deep link: unable to parse metrics explorer URL", "ProjectName",
			timeSeriesFilter.ProjectName, "query", timeSeriesFilter.RefID)
		return ""
	}

	rawQuery := u.Query()
	rawQuery.Set("project", timeSeriesFilter.ProjectName)
	rawQuery.Set("Grafana_deeplink", "true")

	pageState := map[string]interface{}{
		"xyChart": map[string]interface{}{
			"constantLines": []string{},
			"dataSets": []map[string]interface{}{
				{
					"timeSeriesFilter": map[string]interface{}{
						"aggregations":           []string{},
						"crossSeriesReducer":     timeSeriesFilter.Params.Get("aggregation.crossSeriesReducer"),
						"filter":                 filter,
						"groupByFields":          timeSeriesFilter.Params["aggregation.groupByFields"],
						"minAlignmentPeriod":     strings.TrimPrefix(timeSeriesFilter.Params.Get("aggregation.alignmentPeriod"), "+"), // get rid of leading +
						"perSeriesAligner":       timeSeriesFilter.Params.Get("aggregation.perSeriesAligner"),
						"secondaryGroupByFields": []string{},
						"unitOverride":           "1",
					},
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
			"start":     timeSeriesFilter.Params.Get("interval.startTime"),
			"end":       timeSeriesFilter.Params.Get("interval.endTime"),
		},
	}

	blob, err := json.Marshal(pageState)
	if err != nil {
		slog.Error("Failed to generate deep link", "pageState", pageState, "ProjectName", timeSeriesFilter.ProjectName,
			"query", timeSeriesFilter.RefID)
		return ""
	}

	rawQuery.Set("pageState", string(blob))
	u.RawQuery = rawQuery.Encode()

	accountChooserURL, err := url.Parse("https://accounts.google.com/AccountChooser")
	if err != nil {
		slog.Error("Failed to generate deep link: unable to parse account chooser URL", "ProjectName",
			timeSeriesFilter.ProjectName, "query", timeSeriesFilter.RefID)
		return ""
	}
	accountChooserQuery := accountChooserURL.Query()
	accountChooserQuery.Set("continue", u.String())
	accountChooserURL.RawQuery = accountChooserQuery.Encode()

	return accountChooserURL.String()
}

func setDisplayNameAsFieldName(f *data.Field) {
	if f.Config == nil {
		f.Config = &data.FieldConfig{}
	}
	f.Config.DisplayNameFromDS = f.Name
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) getRefID() string {
	return timeSeriesFilter.RefID
}
