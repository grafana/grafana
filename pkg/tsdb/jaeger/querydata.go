package jaeger

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type jaegerQuery struct {
	QueryType   string `json:"queryType"`
	Service     string `json:"service"`
	Operation   string `json:"operation"`
	Query       string `json:"query"`
	Tags        string `json:"tags"`
	MinDuration string `json:"minDuration"`
	MaxDuration string `json:"maxDuration"`
	Limit       int    `json:"limit"`
}

type jaegerSpan struct {
	TraceID       string `json:"traceID"`
	SpanID        string `json:"spanID"`
	OperationName string `json:"operationName"`
	StartTime     int64  `json:"startTime"`
	Duration      int64  `json:"duration"`
	ProcessID     string `json:"processID"`
	Tags          []struct {
		Key   string          `json:"key"`
		Value json.RawMessage `json:"value"`
	} `json:"tags"`
}

type jaegerProcess struct {
	ServiceName string `json:"serviceName"`
	Tags        []struct {
		Key   string          `json:"key"`
		Value json.RawMessage `json:"value"`
	} `json:"tags"`
}

type jaegerTrace struct {
	TraceID   string                   `json:"traceID"`
	Spans     []jaegerSpan             `json:"spans"`
	Processes map[string]jaegerProcess `json:"processes"`
}

type jaegerResponse struct {
	Data []jaegerTrace `json:"data"`
}

func queryData(ctx context.Context, dsInfo *datasourceInfo, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	logger := dsInfo.JaegerClient.logger.FromContext(ctx)

	for _, q := range req.Queries {
		var query jaegerQuery

		err := json.Unmarshal(q.JSON, &query)
		if err != nil {
			response.Responses[q.RefID] = backend.DataResponse{
				Error:       err,
				ErrorSource: backend.ErrorSourcePlugin,
			}
			continue
		}

		// Handle "Upload" query type
		if query.QueryType == "upload" {
			logger.Debug("upload query type is not supported in backend mode")
			response.Responses[q.RefID] = backend.DataResponse{
				Error:       fmt.Errorf("unsupported query type %s. only available in frontend mode", query.QueryType),
				ErrorSource: backend.ErrorSourcePlugin,
			}
			continue
		}

		// Handle "Search" query type
		if query.QueryType == "search" {
			res, err := querySearch(ctx, dsInfo, &query, q.RefID)
			if err != nil {
				response.Responses[q.RefID] = backend.DataResponse{
					Error:       err,
					ErrorSource: backend.ErrorSourceDownstream,
				}
				continue
			}

			response.Responses[q.RefID] = backend.DataResponse{
				Frames: data.Frames{res},
			}
		}

		// Handle "TraceID" query type
		// ...
	}

	return response, nil
}

func querySearch(ctx context.Context, dsInfo *datasourceInfo, query *jaegerQuery, refID string) (*data.Frame, error) {
	jaegerURL, err := createJaegerURL(dsInfo.JaegerClient.url, query)
	if err != nil {
		return nil, err
	}

	resp, err := dsInfo.JaegerClient.httpClient.Get(jaegerURL.String())
	if err != nil {
		return nil, fmt.Errorf("failed to make request to Jaeger: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Jaeger API returned non-200 status code: %d", resp.StatusCode)
	}

	var result jaegerResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode Jaeger response: %w", err)
	}

	frame := createDataFrame()
	for _, trace := range result.Data {
		addTraceToDataFrame(trace, frame)
	}

	return frame, nil
}

func createJaegerURL(baseURL string, query *jaegerQuery) (*url.URL, error) {
	jaegerURL, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Jaeger URL: %w", err)
	}
	jaegerURL.Path = "/api/traces"

	queryParams := map[string]string{
		"service":     query.Service,
		"operation":   query.Operation,
		"tags":        query.Tags,
		"minDuration": query.MinDuration,
		"maxDuration": query.MaxDuration,
	}

	urlQuery := jaegerURL.Query()
	for key, value := range queryParams {
		if value != "" {
			urlQuery.Set(key, value)
		}
	}

	if query.Limit > 0 {
		urlQuery.Set("limit", fmt.Sprintf("%d", query.Limit))
	}

	jaegerURL.RawQuery = urlQuery.Encode()
	return jaegerURL, nil
}

func createDataFrame() *data.Frame {
	frame := data.NewFrame("traces",
		data.NewField("traceID", nil, []string{}).SetConfig(&data.FieldConfig{
			DisplayName: "Trace ID",
		}),
		data.NewField("traceName", nil, []string{}).SetConfig(&data.FieldConfig{
			DisplayName: "Trace name",
		}),
		data.NewField("startTime", nil, []time.Time{}).SetConfig(&data.FieldConfig{
			DisplayName: "Start time",
		}),
		data.NewField("duration", nil, []int64{}).SetConfig(&data.FieldConfig{
			DisplayName: "Duration",
			Unit:        "µs",
		}),
	)

	frame.Meta = &data.FrameMeta{
		PreferredVisualization: "table",
	}

	return frame
}

func addTraceToDataFrame(trace jaegerTrace, frame *data.Frame) {
	if len(trace.Spans) == 0 {
		return
	}

	rootSpan := trace.Spans[0]

	serviceName := ""
	if process, ok := trace.Processes[rootSpan.ProcessID]; ok {
		serviceName = process.ServiceName
	}

	traceName := fmt.Sprintf("%s: %s", serviceName, rootSpan.OperationName)
	startTime := time.Unix(0, rootSpan.StartTime*1000)

	frame.AppendRow(
		trace.TraceID,
		traceName,
		startTime,
		rootSpan.Duration,
	)
}
