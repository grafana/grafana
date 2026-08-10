package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-prometheus-datasource/pkg/promlib/intervalv2"
	prommodels "github.com/grafana/grafana-prometheus-datasource/pkg/promlib/models"
)

type promQLQueryModel struct {
	Region           string `json:"region"`
	PromqlExpression string `json:"promqlExpression"`
	Instant          bool   `json:"instant,omitempty"`
	Range            bool   `json:"range,omitempty"`
	Interval         string `json:"interval,omitempty"`
}

func (m promQLQueryModel) effectiveModes() (instant, rangeQuery bool) {
	if !m.Instant && !m.Range {
		return false, true
	}
	return m.Instant, m.Range
}

// resolveStepSeconds computes the query_range step (in seconds) using the same
// logic as the Prometheus datasource: the requested min step, the calculated
// interval, the time range and max data points all feed into the result, and it
// is clamped so it never exceeds Prometheus' safe resolution limit.
func resolveStepSeconds(q backend.DataQuery, minStep string) float64 {
	calculatedStep, err := prommodels.CalculatePrometheusInterval(minStep, "", q.Interval.Milliseconds(), 0, q, intervalv2.NewCalculator())
	if err != nil {
		// Fall back to the frontend-calculated interval if parsing fails.
		calculatedStep = q.Interval
	}
	step := calculatedStep.Seconds()
	if step < 1 {
		step = 1
	}
	return step
}

type prometheusRangeSeries struct {
	Metric     map[string]string `json:"metric"`
	Values     [][]interface{}   `json:"values"`
	Histograms [][]interface{}   `json:"histograms"`
}

type prometheusInstantSeries struct {
	Metric    map[string]string `json:"metric"`
	Value     []interface{}     `json:"value,omitempty"`
	Histogram []interface{}     `json:"histogram,omitempty"`
}

type prometheusRangeResponse struct {
	Status string `json:"status"`
	Data   struct {
		Result []prometheusRangeSeries `json:"result"`
	} `json:"data"`
	Error     string   `json:"error,omitempty"`
	ErrorType string   `json:"errorType,omitempty"`
	Warnings  []string `json:"warnings,omitempty"`
}

type prometheusInstantResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string                    `json:"resultType"`
		Result     []prometheusInstantSeries `json:"result"`
	} `json:"data"`
	Error     string   `json:"error,omitempty"`
	ErrorType string   `json:"errorType,omitempty"`
	Warnings  []string `json:"warnings,omitempty"`
}

func (ds *DataSource) executePromQLQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		var model promQLQueryModel
		if err := json.Unmarshal(q.JSON, &model); err != nil {
			resp.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("failed to parse PromQL query: %w", err)))
			continue
		}

		if strings.TrimSpace(model.PromqlExpression) == "" {
			resp.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("PromQL expression is required")))
			continue
		}

		region := model.Region
		if region == defaultRegion || region == "" {
			region = ds.Settings.Region
		}

		if instant, _ := model.effectiveModes(); instant {
			resp.Responses[q.RefID] = ds.executePromQLInstant(ctx, region, model.PromqlExpression, q, q.RefID)
		} else {
			resp.Responses[q.RefID] = ds.executePromQLRange(ctx, region, model.PromqlExpression, model.Interval, q)
		}
	}

	return resp, nil
}

func (ds *DataSource) executePromQLRange(ctx context.Context, region, expression, minStep string, q backend.DataQuery) backend.DataResponse {
	stepSecs := resolveStepSeconds(q, minStep)

	params := url.Values{}
	params.Set("query", expression)
	params.Set("start", strconv.FormatInt(q.TimeRange.From.Unix(), 10))
	params.Set("end", strconv.FormatInt(q.TimeRange.To.Unix(), 10))
	params.Set("step", strconv.FormatFloat(stepSecs, 'f', 0, 64))

	body, status, err := ds.promqlSignedGet(ctx, region, "/api/v1/query_range", params, 60*time.Second)
	if err != nil {
		return backend.ErrorResponseWithErrorSource(err)
	}
	if status != http.StatusOK {
		return backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("CloudWatch PromQL API returned %d: %s", status, body)))
	}

	var promResp prometheusRangeResponse
	if err := json.Unmarshal(body, &promResp); err != nil {
		return backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("failed to parse response: %w", err)))
	}
	if promResp.Status != "success" {
		return backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("PromQL error (%s): %s", promResp.ErrorType, promResp.Error)))
	}

	frames := convertPromRangeResultToDataFrames(promResp, q.RefID, stepSecs)
	return backend.DataResponse{Frames: attachWarnings(frames, q.RefID, promResp.Warnings)}
}

func (ds *DataSource) executePromQLInstant(ctx context.Context, region, expression string, q backend.DataQuery, refID string) backend.DataResponse {
	params := url.Values{}
	params.Set("query", expression)
	params.Set("time", strconv.FormatInt(q.TimeRange.To.Unix(), 10))

	body, status, err := ds.promqlSignedGet(ctx, region, "/api/v1/query", params, 60*time.Second)
	if err != nil {
		return backend.ErrorResponseWithErrorSource(err)
	}
	if status != http.StatusOK {
		return backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("CloudWatch PromQL API returned %d: %s", status, body)))
	}

	var promResp prometheusInstantResponse
	if err := json.Unmarshal(body, &promResp); err != nil {
		return backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("failed to parse response: %w", err)))
	}
	if promResp.Status != "success" {
		return backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("PromQL error (%s): %s", promResp.ErrorType, promResp.Error)))
	}

	frames := convertPromInstantResultToDataFrames(promResp, refID)
	return backend.DataResponse{Frames: attachWarnings(frames, refID, promResp.Warnings)}
}

// attachWarnings surfaces any warnings returned by the CloudWatch PromQL API as frame
// notices so they show up in the panel. The API caps responses (e.g. 500 series) and
// signals truncation via the warnings field, which users otherwise wouldn't see.
func attachWarnings(frames data.Frames, refID string, warnings []string) data.Frames {
	if len(warnings) == 0 {
		return frames
	}

	notices := make([]data.Notice, 0, len(warnings))
	for _, w := range warnings {
		notices = append(notices, data.Notice{Severity: data.NoticeSeverityWarning, Text: w})
	}

	// Ensure there's a frame to carry the notices even when no series were returned.
	if len(frames) == 0 {
		frame := data.NewFrame(refID)
		frame.RefID = refID
		frames = data.Frames{frame}
	}

	if frames[0].Meta == nil {
		frames[0].Meta = &data.FrameMeta{}
	}
	frames[0].Meta.Notices = append(frames[0].Meta.Notices, notices...)

	return frames
}

func valueFieldName(labels map[string]string) string {
	if name := labels["__name__"]; name != "" {
		return name
	}
	return "Value"
}

func convertPromRangeResultToDataFrames(promResp prometheusRangeResponse, refID string, stepSecs float64) data.Frames {
	var frames data.Frames

	for _, series := range promResp.Data.Result {
		times := make([]time.Time, 0)
		values := make([]float64, 0)

		for _, point := range series.Values {
			ts, val, ok := parseStringPoint(point)
			if !ok {
				continue
			}
			times = append(times, time.Unix(int64(ts), 0).UTC())
			values = append(values, val)
		}

		if len(times) == 0 {
			for _, point := range series.Histograms {
				ts, val, ok := parseHistogramPoint(point)
				if !ok {
					continue
				}
				times = append(times, time.Unix(int64(ts), 0).UTC())
				values = append(values, val)
			}
		}

		frame := data.NewFrame(refID,
			data.NewField("Time", nil, times),
			data.NewField(valueFieldName(series.Metric), data.Labels(series.Metric), values),
		)
		frame.RefID = refID
		frame.Meta = &data.FrameMeta{Custom: map[string]interface{}{"period": stepSecs}}
		frames = append(frames, frame)
	}

	return frames
}

func convertPromInstantResultToDataFrames(promResp prometheusInstantResponse, refID string) data.Frames {
	var frames data.Frames

	for _, series := range promResp.Data.Result {
		ts, val, ok := parseStringPoint(series.Value)
		if !ok {
			ts, val, ok = parseHistogramPoint(series.Histogram)
		}
		if !ok {
			continue
		}

		frame := data.NewFrame(refID,
			data.NewField("Time", nil, []time.Time{time.Unix(int64(ts), 0).UTC()}),
			data.NewField(valueFieldName(series.Metric), data.Labels(series.Metric), []float64{val}),
		)
		frame.RefID = refID
		frames = append(frames, frame)
	}

	return frames
}

func parseStringPoint(point []interface{}) (float64, float64, bool) {
	if len(point) != 2 {
		return 0, 0, false
	}
	ts, ok := point[0].(float64)
	if !ok {
		return 0, 0, false
	}
	valStr, ok := point[1].(string)
	if !ok {
		return 0, 0, false
	}
	val, err := strconv.ParseFloat(valStr, 64)
	if err != nil {
		return 0, 0, false
	}
	return ts, val, true
}

func parseHistogramPoint(point []interface{}) (float64, float64, bool) {
	if len(point) != 2 {
		return 0, 0, false
	}
	ts, ok := point[0].(float64)
	if !ok {
		return 0, 0, false
	}
	h, ok := point[1].(map[string]interface{})
	if !ok {
		return 0, 0, false
	}
	sum, count := histogramSumCount(h)
	if count == 0 {
		return 0, 0, false
	}
	return ts, sum / count, true
}

func histogramSumCount(h map[string]interface{}) (sum, count float64) {
	if s, ok := h["sum"]; ok {
		switch v := s.(type) {
		case float64:
			sum = v
		case string:
			sum, _ = strconv.ParseFloat(v, 64)
		}
	}
	if c, ok := h["count"]; ok {
		switch v := c.(type) {
		case float64:
			count = v
		case string:
			count, _ = strconv.ParseFloat(v, 64)
		}
	}
	return sum, count
}
