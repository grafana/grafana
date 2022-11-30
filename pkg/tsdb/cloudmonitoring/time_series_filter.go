package cloudmonitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/huandu/xstrings"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, tracer tracing.Tracer) (*backend.DataResponse, cloudMonitoringResponse, string, error) {
	return runTimeSeriesRequest(ctx, timeSeriesFilter.logger, req, s, dsInfo, tracer, timeSeriesFilter.parameters.ProjectName, timeSeriesFilter.params, nil)
}

func extractTimeSeriesLabels(series timeSeries, groupBys []string) (data.Labels, string) {
	seriesLabels := data.Labels{}
	defaultMetricName := series.Metric.Type
	seriesLabels["resource.type"] = series.Resource.Type
	groupBysMap := make(map[string]bool)
	for _, groupBy := range groupBys {
		groupBysMap[groupBy] = true
	}

	for key, value := range series.Metric.Labels {
		seriesLabels["metric.label."+key] = value

		if len(groupBys) == 0 || groupBysMap["metric.label."+key] {
			defaultMetricName += " " + value
		}
	}

	for key, value := range series.Resource.Labels {
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
				seriesLabels[key] = v
			case bool:
				strVal := strconv.FormatBool(v)
				seriesLabels[key] = strVal
			case []interface{}:
				for _, v := range v {
					strVal := v.(string)
					if len(seriesLabels[key]) > 0 {
						strVal = fmt.Sprintf("%s, %s", seriesLabels[key], strVal)
					}
					seriesLabels[key] = strVal
				}
			}
		}
	}

	return seriesLabels, defaultMetricName
}

func parseTimeSeriesResponse(queryRes *backend.DataResponse,
	response cloudMonitoringResponse, executedQueryString string, query cloudMonitoringQueryExecutor, params url.Values, groupBys []string) error {
	frames := data.Frames{}

	for _, series := range response.TimeSeries {
		seriesLabels, defaultMetricName := extractTimeSeriesLabels(series, groupBys)
		frame := data.NewFrameOfFieldTypes("", len(series.Points), data.FieldTypeTime, data.FieldTypeFloat64)
		frame.RefID = query.getRefID()
		frame.Meta = &data.FrameMeta{
			ExecutedQueryString: executedQueryString,
			Custom: map[string]interface{}{
				"alignmentPeriod":  params.Get("aggregation.alignmentPeriod"),
				"perSeriesAligner": params.Get("aggregation.perSeriesAligner"),
				"labels":           seriesLabels,
				"groupBys":         groupBys,
			},
		}

		var err error
		frames, err = appendFrames(frames, &series, 0, defaultMetricName, seriesLabels, frame, query)
		if err != nil {
			return err
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
