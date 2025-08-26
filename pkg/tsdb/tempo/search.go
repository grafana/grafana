package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
	v1 "github.com/grafana/tempo/pkg/tempopb/common/v1"
)

// SearchResponse represents the response from Tempo's search API.
// Note: We cannot use tempopb.SearchResponse directly because the Tempo API
// returns some numeric fields as strings in JSON (e.g., startTimeUnixNano as "1234567890")
// while the tempopb types expect uint64.
type SearchResponse struct {
	Traces []*TraceSearchMetadata `json:"traces,omitempty"`
}

type TraceSearchMetadata struct {
	TraceID           string                           `json:"traceID,omitempty"`
	RootServiceName   string                           `json:"rootServiceName,omitempty"`
	RootTraceName     string                           `json:"rootTraceName,omitempty"`
	StartTimeUnixNano string                           `json:"startTimeUnixNano,omitempty"`
	DurationMs        uint32                           `json:"durationMs,omitempty"`
	SpanSet           *SpanSet                         `json:"spanSet,omitempty"`
	SpanSets          []*SpanSet                       `json:"spanSets,omitempty"`
	ServiceStats      map[string]*tempopb.ServiceStats `json:"serviceStats,omitempty"`
}

type SpanSet struct {
	Spans      []*Span        `json:"spans,omitempty"`
	Matched    uint32         `json:"matched,omitempty"`
	Attributes []*v1.KeyValue `json:"attributes,omitempty"`
}

type Span struct {
	SpanID            string         `json:"spanID,omitempty"`
	Name              string         `json:"name,omitempty"`
	StartTimeUnixNano string         `json:"startTimeUnixNano,omitempty"`
	DurationNanos     string         `json:"durationNanos,omitempty"`
	Attributes        []*v1.KeyValue `json:"attributes,omitempty"`
}

func (s *Service) Search(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (*backend.DataResponse, error) {
	ctxLogger := s.logger.FromContext(ctx)

	dsInfo, err := s.getDSInfo(ctx, pCtx)
	if err != nil {
		ctxLogger.Error("Failed to get datasource information", "error", err, "function", logEntrypoint())
		return nil, err
	}

	model := &dataquery.TempoQuery{}
	err = json.Unmarshal(query.JSON, model)
	if err != nil {
		ctxLogger.Error("Failed to unmarshall Tempo query model", "error", err, "function", logEntrypoint())
		return nil, err
	}

	req, err := createSearchRequest(ctx, dsInfo, model, query.TimeRange.From.Unix(), query.TimeRange.To.Unix())
	if err != nil {
		ctxLogger.Error("Failed to create search request", "error", err, "function", logEntrypoint())
		return nil, err
	}

	resp, err := dsInfo.HTTPClient.Do(req)
	if err != nil {
		ctxLogger.Error("Failed to send request to Tempo", "error", err, "function", logEntrypoint())
		return nil, err
	}

	defer func() {
		if resp != nil && resp.Body != nil {
			if err := resp.Body.Close(); err != nil {
				ctxLogger.Error("Failed to close response body", "error", err, "function", logEntrypoint())
			}
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		ctxLogger.Error("Failed to read response body", "error", err, "function", logEntrypoint())
		return nil, err
	}

	var response SearchResponse
	err = json.Unmarshal(body, &response)
	if err != nil {
		ctxLogger.Error("Failed to unmarshal response to SearchResponse", "error", err, "function", logEntrypoint())
		return nil, err
	}

	frames, err := transformSearchResponse(pCtx, &response)
	if err != nil {
		ctxLogger.Error("Failed to convert SearchResponse to frames", "error", err, "function", logEntrypoint())
		return nil, err
	}

	result := &backend.DataResponse{}
	result.Frames = frames
	return result, nil
}

func createSearchRequest(ctx context.Context, dsInfo *DatasourceInfo, model *dataquery.TempoQuery, start int64, end int64) (*http.Request, error) {
	var tempoQuery string

	baseUrl := fmt.Sprintf("%s/api/search", dsInfo.URL)
	params := make([]string, 0)

	if model.Query != nil && *model.Query != "" {
		params = append(params, fmt.Sprintf("q=%s", *model.Query))
	}

	if model.Limit != nil && *model.Limit > 0 {
		params = append(params, fmt.Sprintf("limit=%d", *model.Limit))
	}

	if model.Spss != nil && *model.Spss > 0 {
		params = append(params, fmt.Sprintf("spss=%d", *model.Spss))
	}

	if start != 0 && end != 0 {
		params = append(params, fmt.Sprintf("start=%d", start))
		params = append(params, fmt.Sprintf("end=%d", end))
	}

	if len(params) > 0 {
		tempoQuery = fmt.Sprintf("%s?%s", baseUrl, strings.Join(params, "&"))
	} else {
		tempoQuery = baseUrl
	}

	req, err := http.NewRequestWithContext(ctx, "GET", tempoQuery, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	return req, nil
}

func transformSearchResponse(pCtx backend.PluginContext, response *SearchResponse) ([]*data.Frame, error) {
	tracesFrame := data.NewFrame("Traces")
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("traceID", nil, []string{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Trace ID",
		Links: []data.DataLink{
			{
				Title: "Trace: ${__value.raw}",
				URL:   "",
				Internal: &data.InternalDataLink{
					DatasourceUID:  pCtx.DataSourceInstanceSettings.UID,
					DatasourceName: pCtx.DataSourceInstanceSettings.Name,
					Query: map[string]interface{}{
						"query":     "${__value.raw}",
						"queryType": "traceql",
					},
				},
			},
		},
	}))
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("startTime", nil, []time.Time{}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "Start time"}))
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("traceService", nil, []string{}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "Service"}))
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("traceName", nil, []string{}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "Name"}))
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("traceDuration", nil, []*float64{}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "Duration", Unit: "ms", NoValue: "<1 ms"}))

	tracesFrame.Meta = &data.FrameMeta{
		PreferredVisualization: data.VisTypeTable,
		Custom: map[string]interface{}{
			"uniqueRowIdFields": []int{0},
		},
	}

	if response == nil {
		return []*data.Frame{tracesFrame}, nil
	}

	if len(response.Traces) == 0 {
		return []*data.Frame{tracesFrame}, nil
	}

	traces := make([]*TraceSearchMetadata, len(response.Traces))
	copy(traces, response.Traces)

	for i := 0; i < len(traces)-1; i++ {
		for j := i + 1; j < len(traces); j++ {
			if traces[i].StartTimeUnixNano < traces[j].StartTimeUnixNano {
				traces[i], traces[j] = traces[j], traces[i]
			}
		}
	}

	for _, trace := range traces {
		startTimeUnixNano, err := strconv.ParseInt(trace.StartTimeUnixNano, 10, 64)
		if err != nil {
			tracesFrame.Fields[1].Append(time.Time{})
		} else {
			tracesFrame.Fields[1].Append(time.Unix(0, startTimeUnixNano))
		}

		var traceDurationMs *float64
		if trace.DurationMs >= 1 {
			val := float64(trace.DurationMs)
			traceDurationMs = &val
		} else {
			traceDurationMs = nil
		}

		backend.Logger.Error("NEW WITH NIL?")
		tracesFrame.Fields[0].Append(trace.TraceID)
		tracesFrame.Fields[2].Append(trace.RootServiceName)
		tracesFrame.Fields[3].Append(trace.RootTraceName)
		tracesFrame.Fields[4].Append(traceDurationMs)
	}

	return []*data.Frame{tracesFrame}, nil
}
