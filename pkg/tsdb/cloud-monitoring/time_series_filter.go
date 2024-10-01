package cloudmonitoring

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/huandu/xstrings"

	"github.com/grafana/grafana/pkg/tsdb/cloud-monitoring/kinds/dataquery"
)

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, logger log.Logger) (*backend.DataResponse, any, string, error) {
	return runTimeSeriesRequest(ctx, req, s, dsInfo, timeSeriesFilter.parameters.ProjectName, timeSeriesFilter.params, nil, logger)
}

func parseTimeSeriesResponse(queryRes *backend.DataResponse,
	response cloudMonitoringResponse, executedQueryString string, query cloudMonitoringQueryExecutor, params url.Values, groupBys []string, logger log.Logger) error {
	frames := data.Frames{}

	for _, series := range response.TimeSeries {
		seriesLabels, defaultMetricName := series.getLabels(groupBys)
		frame := data.NewFrameOfFieldTypes("", len(series.Points), data.FieldTypeTime, data.FieldTypeFloat64)
		frame.RefID = query.getRefID()
		frame.Meta = &data.FrameMeta{
			ExecutedQueryString: executedQueryString,
			Custom: map[string]any{
				"alignmentPeriod":  params.Get("aggregation.alignmentPeriod"),
				"perSeriesAligner": params.Get("aggregation.perSeriesAligner"),
				"labels":           seriesLabels,
				"groupBys":         groupBys,
			},
		}

		var err error
		frames, err = appendFrames(frames, series, 0, defaultMetricName, seriesLabels, frame, query)
		if err != nil {
			return err
		}
	}
	if len(response.TimeSeries) > 0 {
		dl := query.buildDeepLink()
		aggregationAlignmentString := params.Get("aggregation.alignmentPeriod")
		frames = addConfigData(frames, dl, response.Unit, &aggregationAlignmentString, logger)
	}

	queryRes.Frames = frames

	return nil
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) parseResponse(queryRes *backend.DataResponse,
	response any, executedQueryString string, logger log.Logger) error {
	return parseTimeSeriesResponse(queryRes, response.(cloudMonitoringResponse), executedQueryString, timeSeriesFilter, timeSeriesFilter.params, timeSeriesFilter.parameters.GroupBys, logger)
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) buildDeepLink() string {
	filter := timeSeriesFilter.params.Get("filter")
	if !strings.Contains(filter, "resource.type=") {
		resourceType := timeSeriesFilter.params.Get("resourceType")
		if resourceType != "" {
			filter = fmt.Sprintf(`resource.type="%s" %s`, resourceType, filter)
		}
	}
	dataSets := []map[string]any{
		{
			"timeSeriesFilter": map[string]any{
				"aggregations":           []string{},
				"crossSeriesReducer":     timeSeriesFilter.params.Get("aggregation.crossSeriesReducer"),
				"filter":                 filter,
				"groupByFields":          timeSeriesFilter.params["aggregation.groupByFields"],
				"minAlignmentPeriod":     strings.TrimPrefix(timeSeriesFilter.params.Get("aggregation.alignmentPeriod"), "+"), // get rid of leading +
				"perSeriesAligner":       timeSeriesFilter.params.Get("aggregation.perSeriesAligner"),
				"secondaryGroupByFields": []string{},
				"unitOverride":           "1",
			},
		}}

	link, err := generateLink(
		timeSeriesFilter.parameters.ProjectName,
		dataSets,
		timeSeriesFilter.params.Get("interval.startTime"),
		timeSeriesFilter.params.Get("interval.endTime"),
	)
	if err != nil {
		backend.Logger.Error(
			"Failed to generate deep link: unable to parse metrics explorer URL",
			"ProjectName", timeSeriesFilter.parameters.ProjectName,
			"error", err,
			"statusSource", backend.ErrorSourcePlugin,
		)
	}

	return link
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

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) setPreprocessor() {
	// In case a preprocessor is defined, the preprocessor becomes the primary aggregation
	// and the aggregation that is specified in the UI becomes the secondary aggregation
	// Rules are specified in this issue: https://github.com/grafana/grafana/issues/30866
	if timeSeriesFilter.parameters.Preprocessor != nil && toPreprocessorType(string(*timeSeriesFilter.parameters.Preprocessor)) != PreprocessorTypeNone {
		// Move aggregation to secondaryAggregations
		timeSeriesFilter.parameters.SecondaryAlignmentPeriod = timeSeriesFilter.parameters.AlignmentPeriod
		scsr := timeSeriesFilter.parameters.CrossSeriesReducer
		timeSeriesFilter.parameters.SecondaryCrossSeriesReducer = &scsr
		timeSeriesFilter.parameters.SecondaryPerSeriesAligner = timeSeriesFilter.parameters.PerSeriesAligner
		timeSeriesFilter.parameters.SecondaryGroupBys = timeSeriesFilter.parameters.GroupBys

		// Set a default cross series reducer if grouped
		if len(timeSeriesFilter.parameters.GroupBys) == 0 {
			timeSeriesFilter.parameters.CrossSeriesReducer = crossSeriesReducerDefault
		}

		// Set aligner based on preprocessor type
		aligner := "ALIGN_RATE"
		if timeSeriesFilter.parameters.Preprocessor != nil && toPreprocessorType(string(*timeSeriesFilter.parameters.Preprocessor)) == PreprocessorTypeDelta {
			aligner = "ALIGN_DELTA"
		}
		timeSeriesFilter.parameters.PerSeriesAligner = &aligner
	}
}

func (timeSeriesFilter *cloudMonitoringTimeSeriesList) setParams(startTime time.Time, endTime time.Time, durationSeconds int, intervalMs int64) {
	params := url.Values{}
	query := timeSeriesFilter.parameters

	params.Add("interval.startTime", startTime.UTC().Format(time.RFC3339))
	params.Add("interval.endTime", endTime.UTC().Format(time.RFC3339))

	params.Add("filter", timeSeriesFilter.getFilter())
	if query.View != nil {
		params.Add("view", *query.View)
	}

	if query.CrossSeriesReducer == "" {
		query.CrossSeriesReducer = crossSeriesReducerDefault
	}

	alignMean := perSeriesAlignerDefault
	if query.PerSeriesAligner == nil {
		query.PerSeriesAligner = &alignMean
	}

	if timeSeriesFilter.parameters.Preprocessor == nil {
		var p dataquery.PreprocessorType = ""
		timeSeriesFilter.parameters.Preprocessor = &p
	}

	alignmentPeriodString := ""
	if query.AlignmentPeriod != nil {
		alignmentPeriodString = *query.AlignmentPeriod
	}

	timeSeriesFilter.setPreprocessor()

	alignmentPeriod := calculateAlignmentPeriod(alignmentPeriodString, intervalMs, durationSeconds)
	params.Add("aggregation.alignmentPeriod", alignmentPeriod)
	if query.CrossSeriesReducer != "" {
		params.Add("aggregation.crossSeriesReducer", query.CrossSeriesReducer)
	}
	if query.PerSeriesAligner != nil {
		params.Add("aggregation.perSeriesAligner", *query.PerSeriesAligner)
	}
	for _, groupBy := range query.GroupBys {
		params.Add("aggregation.groupByFields", groupBy)
	}

	if query.SecondaryAlignmentPeriod != nil && *query.SecondaryAlignmentPeriod != "" {
		secondaryAlignmentPeriod := calculateAlignmentPeriod(alignmentPeriodString, intervalMs, durationSeconds)
		params.Add("secondaryAggregation.alignmentPeriod", secondaryAlignmentPeriod)
	}
	if query.SecondaryCrossSeriesReducer != nil && *query.SecondaryCrossSeriesReducer != "" {
		params.Add("secondaryAggregation.crossSeriesReducer", *query.SecondaryCrossSeriesReducer)
	}
	if query.SecondaryPerSeriesAligner != nil {
		params.Add("secondaryAggregation.perSeriesAligner", *query.SecondaryPerSeriesAligner)
	}
	for _, groupBy := range query.SecondaryGroupBys {
		params.Add("secondaryAggregation.groupByFields", groupBy)
	}

	timeSeriesFilter.params = params
}
