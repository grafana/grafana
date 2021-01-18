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

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
)

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) run(ctx context.Context, tsdbQuery *tsdb.TsdbQuery, e *CloudMonitoringExecutor) (*tsdb.QueryResult, cloudMonitoringResponse, string, error) {
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: timeSeriesFilter.RefID}
	projectName := timeSeriesFilter.ProjectName
	if projectName == "" {
		defaultProject, err := e.getDefaultProject(ctx)
		if err != nil {
			queryResult.Error = err
			return queryResult, cloudMonitoringResponse{}, "", nil
		}
		projectName = defaultProject
		slog.Info("No project name set on query, using project name from datasource", "projectName", projectName)
	}

	req, err := e.createRequest(ctx, e.dsInfo, path.Join("cloudmonitoringv3/projects", projectName, "timeSeries"), nil)
	if err != nil {
		queryResult.Error = err
		return queryResult, cloudMonitoringResponse{}, "", nil
	}

	req.URL.RawQuery = timeSeriesFilter.Params.Encode()
	alignmentPeriod, ok := req.URL.Query()["aggregation.alignmentPeriod"]

	if ok {
		seconds, err := strconv.ParseInt(alignmentPeriodRe.FindString(alignmentPeriod[0]), 10, 64)
		if err == nil {
			queryResult.Meta.Set("alignmentPeriod", seconds)
		}
	}

	span, ctx := opentracing.StartSpanFromContext(ctx, "cloudMonitoring query")
	span.SetTag("target", timeSeriesFilter.Target)
	span.SetTag("from", tsdbQuery.TimeRange.From)
	span.SetTag("until", tsdbQuery.TimeRange.To)
	span.SetTag("datasource_id", e.dsInfo.Id)
	span.SetTag("org_id", e.dsInfo.OrgId)

	defer span.Finish()

	if err := opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header)); err != nil {
		queryResult.Error = err
		return queryResult, cloudMonitoringResponse{}, "", nil
	}

	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		queryResult.Error = err
		return queryResult, cloudMonitoringResponse{}, "", nil
	}

	data, err := unmarshalResponse(res)
	if err != nil {
		queryResult.Error = err
		return queryResult, cloudMonitoringResponse{}, "", nil
	}

	return queryResult, data, req.URL.RawQuery, nil
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) parseResponse(queryRes *tsdb.QueryResult, response cloudMonitoringResponse, executedQueryString string) error {
	labels := make(map[string]map[string]bool)
	frames := data.Frames{}
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
			timeSeriesFilter.handleNonDistributionSeries(
				series, defaultMetricName, seriesLabels, queryRes, frame)
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
					frameName := formatLegendKeys(series.Metric.Type, defaultMetricName, seriesLabels, additionalLabels, timeSeriesFilter)
					valueField.Name = frameName
					buckets[i] = &data.Frame{
						Name: frameName,
						Fields: []*data.Field{
							timeField,
							valueField,
						},
						RefID: timeSeriesFilter.RefID,
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
		frames = addConfigData(frames, dl)
	}

	queryRes.Dataframes = tsdb.NewDecodedDataFrames(frames)

	labelsByKey := make(map[string][]string)
	for key, values := range labels {
		for value := range values {
			labelsByKey[key] = append(labelsByKey[key], value)
		}
	}

	queryRes.Meta.Set("labels", labelsByKey)
	queryRes.Meta.Set("groupBys", timeSeriesFilter.GroupBys)
	return nil
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) handleNonDistributionSeries(series timeSeries, defaultMetricName string, seriesLabels map[string]string,
	queryRes *tsdb.QueryResult, frame *data.Frame) {
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
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) parseToAnnotations(queryRes *tsdb.QueryResult, data cloudMonitoringResponse, title string, text string, tags string) error {
	annotations := make([]map[string]string, 0)

	for _, series := range data.TimeSeries {
		// reverse the order to be ascending
		for i := len(series.Points) - 1; i >= 0; i-- {
			point := series.Points[i]
			value := strconv.FormatFloat(point.Value.DoubleValue, 'f', 6, 64)
			if series.ValueType == "STRING" {
				value = point.Value.StringValue
			}
			annotation := make(map[string]string)
			annotation["time"] = point.Interval.EndTime.UTC().Format(time.RFC3339)
			annotation["title"] = formatAnnotationText(title, value, series.Metric.Type, series.Metric.Labels, series.Resource.Labels)
			annotation["tags"] = tags
			annotation["text"] = formatAnnotationText(text, value, series.Metric.Type, series.Metric.Labels, series.Resource.Labels)
			annotations = append(annotations, annotation)
		}
	}

	transformAnnotationToTable(annotations, queryRes)
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
		slog.Error("Failed to generate deep link: unable to parse metrics explorer URL", "ProjectName", timeSeriesFilter.ProjectName, "query", timeSeriesFilter.RefID)
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
		slog.Error("Failed to generate deep link", "pageState", pageState, "ProjectName", timeSeriesFilter.ProjectName, "query", timeSeriesFilter.RefID)
		return ""
	}

	rawQuery.Set("pageState", string(blob))
	u.RawQuery = rawQuery.Encode()

	accountChooserURL, err := url.Parse("https://accounts.google.com/AccountChooser")
	if err != nil {
		slog.Error("Failed to generate deep link: unable to parse account chooser URL", "ProjectName", timeSeriesFilter.ProjectName, "query", timeSeriesFilter.RefID)
		return ""
	}
	accountChooserQuery := accountChooserURL.Query()
	accountChooserQuery.Set("continue", u.String())
	accountChooserURL.RawQuery = accountChooserQuery.Encode()

	return accountChooserURL.String()
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) getRefID() string {
	return timeSeriesFilter.RefID
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesFilter) getUnit() string {
	return timeSeriesFilter.Unit
}
