package cloudmonitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/huandu/xstrings"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func doRequestFilterPage(ctx context.Context, r *http.Request, dsInfo datasourceInfo, params url.Values, logger log.Logger) (cloudMonitoringResponse, error) {
	r.URL.RawQuery = params.Encode()
	r = r.WithContext(ctx)
	res, err := dsInfo.services[cloudMonitor].client.Do(r)
	if err != nil {
		return cloudMonitoringResponse{}, err
	}

	dnext, err := unmarshalResponse(logger, res)
	if err != nil {
		return cloudMonitoringResponse{}, err
	}

	return dnext, nil
}

func runTimeSeriesRequest(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, tracer tracing.Tracer, projectName string, params url.Values, logger log.Logger) (*backend.DataResponse, cloudMonitoringResponse, string, error) {
	dr := &backend.DataResponse{}
	if projectName == "" {
		var err error
		projectName, err = s.getDefaultProject(ctx, dsInfo)
		if err != nil {
			dr.Error = err
			return dr, cloudMonitoringResponse{}, "", nil
		}
		logger.Info("No project name set on query, using project name from datasource", "projectName", projectName)
	}
	r, err := createRequest(logger, &dsInfo, path.Join("/v3/projects", projectName, "timeSeries"), nil)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}
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
	span.SetAttributes("target", params.Encode(), attribute.Key("target").String(params.Encode()))
	span.SetAttributes("from", req.Queries[0].TimeRange.From, attribute.Key("from").String(req.Queries[0].TimeRange.From.String()))
	span.SetAttributes("until", req.Queries[0].TimeRange.To, attribute.Key("until").String(req.Queries[0].TimeRange.To.String()))
	span.SetAttributes("datasource_id", dsInfo.id, attribute.Key("datasource_id").Int64(dsInfo.id))
	span.SetAttributes("org_id", req.PluginContext.OrgID, attribute.Key("org_id").Int64(req.PluginContext.OrgID))
	defer span.End()
	tracer.Inject(ctx, r.Header, span)

	d, err := doRequestFilterPage(ctx, r, dsInfo, params, logger)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}
	nextPageToken := d.NextPageToken
	for nextPageToken != "" {
		params["pageToken"] = []string{d.NextPageToken}
		nextPage, err := doRequestFilterPage(ctx, r, dsInfo, params, logger)
		if err != nil {
			dr.Error = err
			return dr, cloudMonitoringResponse{}, "", nil
		}
		d.TimeSeries = append(d.TimeSeries, nextPage.TimeSeries...)
		nextPageToken = nextPage.NextPageToken
	}

	return dr, d, r.URL.RawQuery, nil
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, tracer tracing.Tracer) (*backend.DataResponse, cloudMonitoringResponse, string, error) {
	return runTimeSeriesRequest(ctx, req, s, dsInfo, tracer, timeSeriesFilter.parameters.ProjectName, timeSeriesFilter.params, timeSeriesFilter.logger)
}

func parseTimeSeriesResponse(queryRes *backend.DataResponse,
	response cloudMonitoringResponse, executedQueryString string, query cloudMonitoringQueryExecutor, params url.Values, groupBys []string) error {
	frames := data.Frames{}

	for _, series := range response.TimeSeries {
		seriesLabels := data.Labels{}
		defaultMetricName := series.Metric.Type
		labels := make(map[string]string)
		labels["resource.type"] = series.Resource.Type
		seriesLabels["resource.type"] = series.Resource.Type
		groupBysMap := make(map[string]bool)
		for _, groupBy := range groupBys {
			groupBysMap[groupBy] = true
		}

		frame := data.NewFrameOfFieldTypes("", len(series.Points), data.FieldTypeTime, data.FieldTypeFloat64)
		frame.RefID = query.getRefID()
		frame.Meta = &data.FrameMeta{
			ExecutedQueryString: executedQueryString,
		}

		for key, value := range series.Metric.Labels {
			labels["metric.label."+key] = value
			seriesLabels["metric.label."+key] = value

			if len(groupBys) == 0 || groupBysMap["metric.label."+key] {
				defaultMetricName += " " + value
			}
		}

		for key, value := range series.Resource.Labels {
			labels["resource.label."+key] = value
			seriesLabels["resource.label."+key] = value

			if groupBysMap["resource.label."+key] {
				defaultMetricName += " " + value
			}
		}

		for labelType, labelTypeValues := range series.MetaData {
			for labelKey, labelValue := range labelTypeValues {
				key := xstrings.ToSnakeCase(fmt.Sprintf("metadata.%s.%s", labelType, labelKey))

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
		customFrameMeta["alignmentPeriod"] = params.Get("aggregation.alignmentPeriod")
		customFrameMeta["perSeriesAligner"] = params.Get("aggregation.perSeriesAligner")
		customFrameMeta["labels"] = labels
		customFrameMeta["groupBys"] = groupBys
		if frame.Meta != nil {
			frame.Meta.Custom = customFrameMeta
		} else {
			frame.SetMeta(&data.FrameMeta{Custom: customFrameMeta})
		}

		// reverse the order to be ascending
		if series.ValueType != "DISTRIBUTION" {
			handleNonDistributionSeries(series, defaultMetricName, seriesLabels, frame, query)
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

					frameName := formatLegendKeys(series.Metric.Type, defaultMetricName, nil, additionalLabels, query)
					valueField.Name = frameName
					valueField.Labels = seriesLabels
					setDisplayNameAsFieldName(valueField)

					buckets[i] = &data.Frame{
						Name: frameName,
						Fields: []*data.Field{
							timeField,
							valueField,
						},
						RefID: query.getRefID(),
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
		dl := query.buildDeepLink()
		frames = addConfigData(frames, dl, response.Unit, params.Get("aggregation.alignmentPeriod"))
	}

	queryRes.Frames = frames

	return nil
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) parseResponse(queryRes *backend.DataResponse,
	response cloudMonitoringResponse, executedQueryString string) error {
	return parseTimeSeriesResponse(queryRes, response, executedQueryString, timeSeriesFilter, timeSeriesFilter.params, timeSeriesFilter.parameters.GroupBys)
}

func handleNonDistributionSeries(series timeSeries,
	defaultMetricName string, seriesLabels map[string]string, frame *data.Frame, query cloudMonitoringQueryExecutor) {
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

	metricName := formatLegendKeys(series.Metric.Type, defaultMetricName, seriesLabels, nil, query)
	dataField := frame.Fields[1]
	dataField.Name = metricName
	dataField.Labels = seriesLabels
	setDisplayNameAsFieldName(dataField)
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) buildDeepLink() string {
	filter := timeSeriesFilter.params.Get("filter")
	if !strings.Contains(filter, "resource.type=") {
		resourceType := timeSeriesFilter.params.Get("resourceType")
		if resourceType != "" {
			filter = fmt.Sprintf(`resource.type="%s" %s`, resourceType, filter)
		}
	}

	u, err := url.Parse("https://console.cloud.google.com/monitoring/metrics-explorer")
	if err != nil {
		slog.Error("Failed to generate deep link: unable to parse metrics explorer URL", "ProjectName",
			timeSeriesFilter.parameters.ProjectName, "query", timeSeriesFilter.refID)
		return ""
	}

	rawQuery := u.Query()
	rawQuery.Set("project", timeSeriesFilter.parameters.ProjectName)
	rawQuery.Set("Grafana_deeplink", "true")

	pageState := map[string]interface{}{
		"xyChart": map[string]interface{}{
			"constantLines": []string{},
			"dataSets": []map[string]interface{}{
				{
					"timeSeriesFilter": map[string]interface{}{
						"aggregations":           []string{},
						"crossSeriesReducer":     timeSeriesFilter.params.Get("aggregation.crossSeriesReducer"),
						"filter":                 filter,
						"groupByFields":          timeSeriesFilter.params["aggregation.groupByFields"],
						"minAlignmentPeriod":     strings.TrimPrefix(timeSeriesFilter.params.Get("aggregation.alignmentPeriod"), "+"), // get rid of leading +
						"perSeriesAligner":       timeSeriesFilter.params.Get("aggregation.perSeriesAligner"),
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
			"start":     timeSeriesFilter.params.Get("interval.startTime"),
			"end":       timeSeriesFilter.params.Get("interval.endTime"),
		},
	}

	blob, err := json.Marshal(pageState)
	if err != nil {
		slog.Error("Failed to generate deep link", "pageState", pageState, "ProjectName", timeSeriesFilter.parameters.ProjectName,
			"query", timeSeriesFilter.refID)
		return ""
	}

	rawQuery.Set("pageState", string(blob))
	u.RawQuery = rawQuery.Encode()

	accountChooserURL, err := url.Parse("https://accounts.google.com/AccountChooser")
	if err != nil {
		slog.Error("Failed to generate deep link: unable to parse account chooser URL", "ProjectName",
			timeSeriesFilter.parameters.ProjectName, "query", timeSeriesFilter.refID)
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

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) getRefID() string {
	return timeSeriesFilter.refID
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) getAliasBy() string {
	return timeSeriesFilter.aliasBy
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) getParameter(i string) string {
	switch i {
	case "project":
		return timeSeriesFilter.parameters.ProjectName
	default:
		return ""
	}
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) getFilter() string {
	filterString := ""
	for i, part := range timeSeriesFilter.parameters.Filters {
		mod := i % 4
		switch {
		case part == "AND":
			filterString += " "
		case mod == 2:
			operator := timeSeriesFilter.parameters.Filters[i-1]
			switch {
			case operator == "=~" || operator == "!=~":
				filterString = xstrings.Reverse(strings.Replace(xstrings.Reverse(filterString), "~", "", 1))
				filterString += fmt.Sprintf(`monitoring.regex.full_match("%s")`, part)
			case strings.Contains(part, "*"):
				filterString += interpolateFilterWildcards(part)
			default:
				filterString += fmt.Sprintf(`"%s"`, part)
			}
		default:
			filterString += part
		}
	}

	return strings.Trim(filterString, " ")
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) setParams(startTime time.Time, endTime time.Time, durationSeconds int, intervalMs int64) {
	params := url.Values{}
	query := timeSeriesFilter.parameters

	params.Add("interval.startTime", startTime.UTC().Format(time.RFC3339))
	params.Add("interval.endTime", endTime.UTC().Format(time.RFC3339))

	params.Add("filter", timeSeriesFilter.getFilter())
	params.Add("view", query.View)

	if query.CrossSeriesReducer == "" {
		query.CrossSeriesReducer = crossSeriesReducerDefault
	}

	if query.PerSeriesAligner == "" {
		query.PerSeriesAligner = perSeriesAlignerDefault
	}

	alignmentPeriod := calculateAlignmentPeriod(query.AlignmentPeriod, intervalMs, durationSeconds)
	params.Add("aggregation.alignmentPeriod", alignmentPeriod)
	if query.CrossSeriesReducer != "" {
		params.Add("aggregation.crossSeriesReducer", query.CrossSeriesReducer)
	}
	if query.PerSeriesAligner != "" {
		params.Add("aggregation.perSeriesAligner", query.PerSeriesAligner)
	}
	for _, groupBy := range query.GroupBys {
		params.Add("aggregation.groupByFields", groupBy)
	}

	if query.SecondaryAlignmentPeriod != "" {
		secondaryAlignmentPeriod := calculateAlignmentPeriod(query.AlignmentPeriod, intervalMs, durationSeconds)
		params.Add("secondaryAggregation.alignmentPeriod", secondaryAlignmentPeriod)
	}
	if query.SecondaryCrossSeriesReducer != "" {
		params.Add("secondaryAggregation.crossSeriesReducer", query.SecondaryCrossSeriesReducer)
	}
	if query.SecondaryPerSeriesAligner != "" {
		params.Add("secondaryAggregation.perSeriesAligner", query.SecondaryPerSeriesAligner)
	}
	for _, groupBy := range query.SecondaryGroupBys {
		params.Add("secondaryAggregation.groupByFields", groupBy)
	}

	timeSeriesFilter.params = params
}
