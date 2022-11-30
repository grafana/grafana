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
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) appendGraphPeriod(req *backend.QueryDataRequest) string {
	// GraphPeriod needs to be explicitly disabled.
	// If not set, the default behavior is to set an automatic value
	if timeSeriesQuery.parameters.GraphPeriod != "disabled" {
		if timeSeriesQuery.parameters.GraphPeriod == "auto" || timeSeriesQuery.parameters.GraphPeriod == "" {
			intervalCalculator := intervalv2.NewCalculator(intervalv2.CalculatorOptions{})
			interval := intervalCalculator.Calculate(req.Queries[0].TimeRange, time.Duration(timeSeriesQuery.IntervalMS/1000)*time.Second, req.Queries[0].MaxDataPoints)
			timeSeriesQuery.parameters.GraphPeriod = interval.Text
		}
		return fmt.Sprintf(" | graph_period %s", timeSeriesQuery.parameters.GraphPeriod)
	}
	return ""
}

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, tracer tracing.Tracer) (*backend.DataResponse, cloudMonitoringResponse, string, error) {
	timeSeriesQuery.parameters.Query += timeSeriesQuery.appendGraphPeriod(req)
	from := req.Queries[0].TimeRange.From
	to := req.Queries[0].TimeRange.To
	timeFormat := "2006/01/02-15:04:05"
	timeSeriesQuery.parameters.Query += fmt.Sprintf(" | within d'%s', d'%s'", from.UTC().Format(timeFormat), to.UTC().Format(timeFormat))
	requestBody := map[string]interface{}{
		"query": timeSeriesQuery.parameters.Query,
	}
	return runTimeSeriesRequest(ctx, timeSeriesQuery.logger, req, s, dsInfo, tracer, timeSeriesQuery.parameters.ProjectName, nil, requestBody)
}

func extractTimeSeriesDataLabels(response cloudMonitoringResponse, series timeSeriesData) map[string]string {
	seriesLabels := make(map[string]string)
	for n, d := range response.TimeSeriesDescriptor.LabelDescriptors {
		key := xstrings.ToSnakeCase(d.Key)
		key = strings.Replace(key, ".", ".label.", 1)

		labelValue := series.LabelValues[n]
		switch d.ValueType {
		case "BOOL":
			strVal := strconv.FormatBool(labelValue.BoolValue)
			seriesLabels[key] = strVal
		case "INT64":
			seriesLabels[key] = labelValue.Int64Value
		default:
			seriesLabels[key] = labelValue.StringValue
		}
	}
	return seriesLabels
}

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) parseResponse(queryRes *backend.DataResponse,
	response cloudMonitoringResponse, executedQueryString string) error {
	frames := data.Frames{}

	for _, series := range response.TimeSeriesData {
		frame := data.NewFrameOfFieldTypes("", len(series.PointData), data.FieldTypeTime, data.FieldTypeFloat64)
		frame.RefID = timeSeriesQuery.refID
		seriesLabels := extractTimeSeriesDataLabels(response, series)

		for n, d := range response.TimeSeriesDescriptor.PointDescriptors {
			// If more than 1 pointdescriptor was returned, three aggregations are returned per time series - min, mean and max.
			// This is a because the period for the given table is less than half the duration which is used in the graph_period MQL function.
			// See https://cloud.google.com/monitoring/mql/reference#graph_period-tabop
			// When this is the case, we'll just ignore the min and max and use the mean value in the frame
			if len(response.TimeSeriesDescriptor.PointDescriptors) > 1 && !strings.HasSuffix(d.Key, ".mean") {
				continue
			}

			seriesLabels["metric.name"] = d.Key
			defaultMetricName := d.Key

			customFrameMeta := map[string]interface{}{}
			customFrameMeta["labels"] = seriesLabels
			frameMeta := &data.FrameMeta{
				ExecutedQueryString: executedQueryString,
				Custom:              customFrameMeta,
			}
			frame.Meta = frameMeta

			var err error
			iterator := timeSeriesDataIterator{series, d}
			frames, err = appendFrames(frames, iterator, n, defaultMetricName, seriesLabels, frame, timeSeriesQuery)
			if err != nil {
				return err
			}
		}
	}
	if len(response.TimeSeriesData) > 0 {
		dl := timeSeriesQuery.buildDeepLink()
		frames = addConfigData(frames, dl, response.Unit, timeSeriesQuery.parameters.GraphPeriod)
	}

	queryRes.Frames = frames

	return nil
}

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) buildDeepLink() string {
	u, err := url.Parse("https://console.cloud.google.com/monitoring/metrics-explorer")
	if err != nil {
		timeSeriesQuery.logger.Error("Failed to generate deep link: unable to parse metrics explorer URL", "projectName", timeSeriesQuery.parameters.ProjectName, "query", timeSeriesQuery.refID)
		return ""
	}

	q := u.Query()
	q.Set("project", timeSeriesQuery.parameters.ProjectName)
	q.Set("Grafana_deeplink", "true")

	pageState := map[string]interface{}{
		"xyChart": map[string]interface{}{
			"constantLines": []string{},
			"dataSets": []map[string]interface{}{
				{
					"timeSeriesQuery": timeSeriesQuery.parameters.Query,
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
		timeSeriesQuery.logger.Error("Failed to generate deep link", "pageState", pageState, "ProjectName", timeSeriesQuery.parameters.ProjectName, "query", timeSeriesQuery.refID)
		return ""
	}

	q.Set("pageState", string(blob))
	u.RawQuery = q.Encode()

	accountChooserURL, err := url.Parse("https://accounts.google.com/AccountChooser")
	if err != nil {
		timeSeriesQuery.logger.Error("Failed to generate deep link: unable to parse account chooser URL", "ProjectName", timeSeriesQuery.parameters.ProjectName, "query", timeSeriesQuery.refID)
		return ""
	}
	accountChooserQuery := accountChooserURL.Query()
	accountChooserQuery.Set("continue", u.String())
	accountChooserURL.RawQuery = accountChooserQuery.Encode()

	return accountChooserURL.String()
}

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) getRefID() string {
	return timeSeriesQuery.refID
}

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) getAliasBy() string {
	return timeSeriesQuery.aliasBy
}

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) getParameter(i string) string {
	switch i {
	case "project":
		return timeSeriesQuery.parameters.ProjectName
	default:
		return ""
	}
}
