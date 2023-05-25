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
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, tracer tracing.Tracer) (*backend.DataResponse, cloudMonitoringResponse, string, error) {
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

	ctx, span := tracer.Start(ctx, "cloudMonitoring query")
	span.SetAttributes("target", timeSeriesFilter.Target, attribute.Key("target").String(timeSeriesFilter.Target))
	span.SetAttributes("from", req.Queries[0].TimeRange.From, attribute.Key("from").String(req.Queries[0].TimeRange.From.String()))
	span.SetAttributes("until", req.Queries[0].TimeRange.To, attribute.Key("until").String(req.Queries[0].TimeRange.To.String()))
	span.SetAttributes("datasource_id", dsInfo.id, attribute.Key("datasource_id").Int64(dsInfo.id))
	span.SetAttributes("org_id", req.PluginContext.OrgID, attribute.Key("org_id").Int64(req.PluginContext.OrgID))

	defer span.End()
	tracer.Inject(ctx, r.Header, span)

	r = r.WithContext(ctx)
	res, err := dsInfo.services[cloudMonitor].client.Do(r)
	defer func() {
		if err := res.Body.Close(); err != nil {
			slog.Warn("Failed to close response body", "err", err)
			return
		}
	}()
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

//nolint:gocyclo
func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) parseResponse(queryRes *backend.DataResponse,
	response cloudMonitoringResponse, executedQueryString string) error {
	frames := data.Frames{}

	for _, series := range response.TimeSeries {
		seriesLabels := data.Labels{}
		defaultMetricName := series.Metric.Type
		labels := make(map[string]string)
		labels["resource.type"] = series.Resource.Type
		seriesLabels["resource.type"] = series.Resource.Type

		frame := data.NewFrameOfFieldTypes("", len(series.Points), data.FieldTypeTime, data.FieldTypeFloat64)
		frame.RefID = timeSeriesFilter.RefID
		frame.Meta = &data.FrameMeta{
			ExecutedQueryString: executedQueryString,
		}

		for key, value := range series.Metric.Labels {
			labels["metric.label."+key] = value
			seriesLabels["metric.label."+key] = value

			if len(timeSeriesFilter.GroupBys) == 0 || containsLabel(timeSeriesFilter.GroupBys, "metric.label."+key) {
				defaultMetricName += " " + value
			}
		}

		for key, value := range series.Resource.Labels {
			labels["resource.label."+key] = value
			seriesLabels["resource.label."+key] = value

			if containsLabel(timeSeriesFilter.GroupBys, "resource.label."+key) {
				defaultMetricName += " " + value
			}
		}

		for labelType, labelTypeValues := range series.MetaData {
			for labelKey, labelValue := range labelTypeValues {
				key := toSnakeCase(fmt.Sprintf("metadata.%s.%s", labelType, labelKey))

				switch v := labelValue.(type) {
				case string:
					labels[key] = v
					seriesLabels[key] = v
				case bool:
					strVal := strconv.FormatBool(v)
					labels[key] = strVal
					seriesLabels[key] = strVal
				case []interface{}:
					for _, v := range v {
						strVal := v.(string)
						labels[key] = strVal
						if len(seriesLabels[key]) > 0 {
							strVal = fmt.Sprintf("%s, %s", seriesLabels[key], strVal)
						}
						seriesLabels[key] = strVal
					}
				}
			}
		}

		customFrameMeta := map[string]interface{}{}
		customFrameMeta["alignmentPeriod"] = timeSeriesFilter.Params.Get("aggregation.alignmentPeriod")
		customFrameMeta["perSeriesAligner"] = timeSeriesFilter.Params.Get("aggregation.perSeriesAligner")
		customFrameMeta["labels"] = labels
		customFrameMeta["groupBys"] = timeSeriesFilter.GroupBys
		if frame.Meta != nil {
			frame.Meta.Custom = customFrameMeta
		} else {
			frame.SetMeta(&data.FrameMeta{Custom: customFrameMeta})
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
			for i := 0; i < len(point.Value.DistributionValue.BucketCounts); i++ {
				value, err := strconv.ParseFloat(point.Value.DistributionValue.BucketCounts[i], 64)
				if err != nil {
					return err
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
						Meta: &data.FrameMeta{
							ExecutedQueryString: executedQueryString,
						},
					}
				}
				buckets[i].AppendRow(point.Interval.EndTime, value)
			}
		}
		for i := 0; i < len(buckets); i++ {
			buckets[i].Meta.Custom = customFrameMeta
			frames = append(frames, buckets[i])
		}
		if len(buckets) == 0 {
			frames = append(frames, frame)
		}
	}
	if len(response.TimeSeries) > 0 {
		dl := timeSeriesFilter.buildDeepLink()
		frames = addConfigData(frames, dl, response.Unit, timeSeriesFilter.Params.Get("aggregation.alignmentPeriod"))
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
	frame := data.NewFrame(timeSeriesFilter.RefID,
		data.NewField("time", nil, []time.Time{}),
		data.NewField("title", nil, []string{}),
		data.NewField("tags", nil, []string{}),
		data.NewField("text", nil, []string{}),
	)

	for _, series := range response.TimeSeries {
		if len(series.Points) == 0 {
			continue
		}

		for i := len(series.Points) - 1; i >= 0; i-- {
			point := series.Points[i]
			value := strconv.FormatFloat(point.Value.DoubleValue, 'f', 6, 64)
			if series.ValueType == "STRING" {
				value = point.Value.StringValue
			}
			annotation := &annotationEvent{
				Time: point.Interval.EndTime,
				Title: formatAnnotationText(title, value, series.Metric.Type,
					series.Metric.Labels, series.Resource.Labels),
				Tags: "",
				Text: formatAnnotationText(text, value, series.Metric.Type,
					series.Metric.Labels, series.Resource.Labels),
			}
			frame.AppendRow(annotation.Time, annotation.Title, annotation.Tags, annotation.Text)
		}
	}
	dr.Frames = append(dr.Frames, frame)

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
