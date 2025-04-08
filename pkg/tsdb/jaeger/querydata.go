package jaeger

import (
	"context"
	"encoding/json"
	"fmt"
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
			res, err := dsInfo.JaegerClient.Search(&query)
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
	}

	return response, nil
}

func transformSearchResponse(response jaegerResponse) *data.Frame {
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

	for _, trace := range response.Data {
		if len(trace.Spans) == 0 {
			continue
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

	return frame
}
