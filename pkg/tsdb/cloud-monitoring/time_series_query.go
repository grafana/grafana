package cloudmonitoring

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	gcmTime "github.com/grafana/grafana/pkg/tsdb/cloud-monitoring/time"
)

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) appendGraphPeriod(req *backend.QueryDataRequest) string {
	// GraphPeriod needs to be explicitly disabled.
	// If not set, the default behavior is to set an automatic value
	if timeSeriesQuery.parameters.GraphPeriod != "disabled" {
		if timeSeriesQuery.parameters.GraphPeriod == "auto" || timeSeriesQuery.parameters.GraphPeriod == "" {
			intervalCalculator := gcmTime.NewCalculator(gcmTime.CalculatorOptions{})
			interval := intervalCalculator.Calculate(timeSeriesQuery.timeRange, time.Duration(timeSeriesQuery.IntervalMS/1000)*time.Second, req.Queries[0].MaxDataPoints)
			timeSeriesQuery.parameters.GraphPeriod = interval.Text
		}
		return fmt.Sprintf(" | graph_period %s", timeSeriesQuery.parameters.GraphPeriod)
	}
	return ""
}

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, logger log.Logger) (*backend.DataResponse, any, string, error) {
	timeSeriesQuery.parameters.Query += timeSeriesQuery.appendGraphPeriod(req)
	from := timeSeriesQuery.timeRange.From
	to := timeSeriesQuery.timeRange.To
	timeFormat := "2006/01/02-15:04:05"
	timeSeriesQuery.parameters.Query += fmt.Sprintf(" | within d'%s', d'%s'", from.UTC().Format(timeFormat), to.UTC().Format(timeFormat))
	requestBody := map[string]any{
		"query": timeSeriesQuery.parameters.Query,
	}
	return runTimeSeriesRequest(ctx, req, s, dsInfo, timeSeriesQuery.parameters.ProjectName, nil, requestBody, logger, timeSeriesQuery.timeRange)
}

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) parseResponse(queryRes *backend.DataResponse,
	res any, executedQueryString string, logger log.Logger) error {
	response := res.(cloudMonitoringResponse)
	frames := data.Frames{}

	for _, series := range response.TimeSeriesData {
		frame := data.NewFrameOfFieldTypes("", len(series.PointData), data.FieldTypeTime, data.FieldTypeFloat64)
		frame.RefID = timeSeriesQuery.refID
		seriesLabels, defaultMetricName := series.getLabels(response.TimeSeriesDescriptor.LabelDescriptors)

		for n, d := range response.TimeSeriesDescriptor.PointDescriptors {
			// If more than 1 pointdescriptor was returned, three aggregations are returned per time series - min, mean and max.
			// This is a because the period for the given table is less than half the duration which is used in the graph_period MQL function.
			// See https://cloud.google.com/monitoring/mql/reference#graph_period-tabop
			// When this is the case, we'll just ignore the min and max and use the mean value in the frame
			if len(response.TimeSeriesDescriptor.PointDescriptors) > 1 && !strings.HasSuffix(d.Key, ".mean") {
				continue
			}

			seriesLabels["metric.name"] = d.Key

			customFrameMeta := map[string]any{}
			customFrameMeta["labels"] = seriesLabels
			frameMeta := &data.FrameMeta{
				ExecutedQueryString: executedQueryString,
				Custom:              customFrameMeta,
			}
			frame.Meta = frameMeta
			frame.Meta.Type = data.FrameTypeTimeSeriesMulti

			var err error
			iterator := timeSeriesDataIterator{series, d}
			frames, err = appendFrames(frames, iterator, n, defaultMetricName, seriesLabels, frame, timeSeriesQuery)
			if err != nil {
				return err
			}
		}
		// Ensure the time field is named correctly
		timeField := frame.Fields[0]
		timeField.Name = data.TimeSeriesTimeFieldName
	}
	if len(response.TimeSeriesData) > 0 {
		dl := timeSeriesQuery.buildDeepLink()
		frames = addConfigData(frames, dl, response.Unit, timeSeriesQuery.parameters.GraphPeriod, logger)
	}

	queryRes.Frames = frames

	return nil
}

func (timeSeriesQuery *cloudMonitoringTimeSeriesQuery) buildDeepLink() string {
	dataSets := []map[string]any{
		{
			"timeSeriesQuery": timeSeriesQuery.parameters.Query,
			"targetAxis":      "Y1",
			"plotType":        "LINE",
		},
	}

	link, err := generateLink(
		timeSeriesQuery.parameters.ProjectName,
		dataSets,
		timeSeriesQuery.timeRange.From.Format(time.RFC3339Nano),
		timeSeriesQuery.timeRange.To.Format(time.RFC3339Nano),
	)
	if err != nil {
		backend.Logger.Error(
			"Failed to generate deep link: unable to parse metrics explorer URL",
			"ProjectName", timeSeriesQuery.parameters.Query,
			"error", err,
			"statusSource", backend.ErrorSourcePlugin,
		)
	}

	return link
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
