package jaeger

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type JaegerQuery struct {
	QueryType   string `json:"queryType"`
	Service     string `json:"service"`
	Operation   string `json:"operation"`
	Query       string `json:"query"`
	Tags        string `json:"tags"`
	MinDuration string `json:"minDuration"`
	MaxDuration string `json:"maxDuration"`
	Limit       int    `json:"limit"`
}

func queryData(ctx context.Context, dsInfo *datasourceInfo, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	logger := dsInfo.JaegerClient.logger.FromContext(ctx)

	for _, q := range req.Queries {
		var query JaegerQuery

		err := json.Unmarshal(q.JSON, &query)
		if err != nil {
			err = backend.DownstreamError(fmt.Errorf("error while parsing the query json. %w", err))
			response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
			continue
		}

		// Handle "Upload" query type
		if query.QueryType == "upload" {
			logger.Debug("upload query type is not supported in backend mode")
			response.Responses[q.RefID] = backend.DataResponse{
				Error:       fmt.Errorf("unsupported query type %s. only available in frontend mode", query.QueryType),
				ErrorSource: backend.ErrorSourceDownstream,
			}
			continue
		}

		// Handle "Search" query type
		if query.QueryType == "search" {
			traces, err := dsInfo.JaegerClient.Search(&query, q.TimeRange.From.UnixMicro(), q.TimeRange.To.UnixMicro())
			if err != nil {
				response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
				continue
			}
			frames := transformSearchResponse(traces, dsInfo)
			response.Responses[q.RefID] = backend.DataResponse{
				Frames: data.Frames{frames},
			}
		}

		// No query type means traceID query
		if query.QueryType == "" {
			traces, err := dsInfo.JaegerClient.Trace(ctx, query.Query, q.TimeRange.From.UnixMilli(), q.TimeRange.To.UnixMilli())
			if err != nil {
				response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
				continue
			}
			frame := transformTraceResponse(traces, q.RefID)
			response.Responses[q.RefID] = backend.DataResponse{
				Frames: []*data.Frame{frame},
			}
		}

		if query.QueryType == "dependencyGraph" {
			dependencies, err := dsInfo.JaegerClient.Dependencies(ctx, q.TimeRange.From.UnixMilli(), q.TimeRange.To.UnixMilli())
			if err != nil {
				response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
				continue
			}

			if len(dependencies.Errors) > 0 {
				response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(fmt.Errorf("error while fetching dependencies, code: %v, message: %v", dependencies.Errors[0].Code, dependencies.Errors[0].Msg)))
				continue
			}
			frames := transformDependenciesResponse(dependencies, q.RefID)
			response.Responses[q.RefID] = backend.DataResponse{
				Frames: frames,
			}
		}
	}

	return response, nil
}

func transformSearchResponse(response []TraceResponse, dsInfo *datasourceInfo) *data.Frame {
	// Create a frame for the traces
	frame := data.NewFrame("traces",
		data.NewField("traceID", nil, []string{}).SetConfig(&data.FieldConfig{
			DisplayName: "Trace ID",
			Links: []data.DataLink{
				{
					Title: "Trace: ${__value.raw}",
					URL:   "",
					Internal: &data.InternalDataLink{
						DatasourceUID:  dsInfo.JaegerClient.settings.UID,
						DatasourceName: dsInfo.JaegerClient.settings.Name,
						Query: map[string]interface{}{
							"query": "${__value.raw}",
						},
					},
				},
			},
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

	// Set the visualization type to table
	frame.Meta = &data.FrameMeta{
		PreferredVisualization: "table",
	}

	// Sort traces by start time in descending order (newest first)
	sort.Slice(response, func(i, j int) bool {
		rootSpanI := response[i].Spans[0]
		rootSpanJ := response[j].Spans[0]

		for _, span := range response[i].Spans {
			if span.StartTime < rootSpanI.StartTime {
				rootSpanI = span
			}
		}

		for _, span := range response[j].Spans {
			if span.StartTime < rootSpanJ.StartTime {
				rootSpanJ = span
			}
		}

		return rootSpanI.StartTime > rootSpanJ.StartTime
	})

	// Process each trace
	for _, trace := range response {
		if len(trace.Spans) == 0 {
			continue
		}

		// Get the root span
		rootSpan := trace.Spans[0]
		for _, span := range trace.Spans {
			if span.StartTime < rootSpan.StartTime {
				rootSpan = span
			}
		}

		// Get the service name for the trace
		serviceName := ""
		if process, ok := trace.Processes[rootSpan.ProcessID]; ok {
			serviceName = process.ServiceName
		}

		// Get the trace name and start time
		traceName := fmt.Sprintf("%s: %s", serviceName, rootSpan.OperationName)
		startTime := time.Unix(0, rootSpan.StartTime*1000)

		// Append the row to the frame
		frame.AppendRow(
			trace.TraceID,
			traceName,
			startTime,
			rootSpan.Duration,
		)
	}

	return frame
}

func transformTraceResponse(trace TraceResponse, refID string) *data.Frame {
	frame := data.NewFrame(refID,
		data.NewField("traceID", nil, []string{}),
		data.NewField("spanID", nil, []string{}),
		data.NewField("parentSpanID", nil, []*string{}),
		data.NewField("operationName", nil, []string{}),
		data.NewField("serviceName", nil, []string{}),
		data.NewField("serviceTags", nil, []json.RawMessage{}),
		data.NewField("startTime", nil, []float64{}),
		data.NewField("duration", nil, []float64{}),
		data.NewField("logs", nil, []json.RawMessage{}),
		data.NewField("references", nil, []json.RawMessage{}),
		data.NewField("tags", nil, []json.RawMessage{}),
		data.NewField("warnings", nil, []json.RawMessage{}),
		data.NewField("stackTraces", nil, []json.RawMessage{}),
	)

	// Set metadata for trace visualization
	frame.Meta = &data.FrameMeta{
		PreferredVisualization: "trace",
		Custom: map[string]interface{}{
			"traceFormat": "jaeger",
		},
	}

	// Process each span in the trace
	for _, span := range trace.Spans {
		// Find parent span ID
		var parentSpanID *string
		for _, ref := range span.References {
			if ref.RefType == "CHILD_OF" {
				s := ref.SpanID
				parentSpanID = &s
				break
			}
		}

		// Get service name and tags
		serviceName := ""
		serviceTags := json.RawMessage{}
		if process, ok := trace.Processes[span.ProcessID]; ok {
			serviceName = process.ServiceName
			tagsMarshaled, err := json.Marshal(process.Tags)
			if err == nil {
				serviceTags = json.RawMessage(tagsMarshaled)
			}
		}

		// Convert logs
		logs := json.RawMessage{}
		logsMarshaled, err := json.Marshal(span.Logs)
		if err == nil {
			logs = json.RawMessage(logsMarshaled)
		}

		// Convert references (excluding parent)
		references := json.RawMessage{}
		filteredRefs := []TraceSpanReference{}
		for _, ref := range span.References {
			if parentSpanID == nil || ref.SpanID != *parentSpanID {
				filteredRefs = append(filteredRefs, ref)
			}
		}
		refsMarshaled, err := json.Marshal(filteredRefs)
		if err == nil {
			references = json.RawMessage(refsMarshaled)
		}

		// Convert tags
		tags := json.RawMessage{}
		tagsMarshaled, err := json.Marshal(span.Tags)
		if err == nil {
			tags = json.RawMessage(tagsMarshaled)
		}

		// Convert warnings
		warnings := json.RawMessage{}
		warningsMarshaled, err := json.Marshal(span.Warnings)
		if err == nil {
			warnings = json.RawMessage(warningsMarshaled)
		}

		// Convert stack traces
		stackTraces := json.RawMessage{}
		stackTracesMarshaled, err := json.Marshal(span.StackTraces)
		if err == nil {
			stackTraces = json.RawMessage(stackTracesMarshaled)
		}

		// Add span to frame
		frame.AppendRow(
			span.TraceID,
			span.SpanID,
			parentSpanID,
			span.OperationName,
			serviceName,
			serviceTags,
			float64(span.StartTime)/1000, // Convert microseconds to milliseconds
			float64(span.Duration)/1000,  // Convert microseconds to milliseconds
			logs,
			references,
			tags,
			warnings,
			stackTraces,
		)
	}

	return frame
}

func transformDependenciesResponse(dependencies DependenciesResponse, refID string) []*data.Frame {
	// Create nodes frame
	nodesFrame := data.NewFrame(refID+"_nodes",
		data.NewField("id", nil, []string{}),
		data.NewField("title", nil, []string{}),
	)
	nodesFrame.Meta = &data.FrameMeta{
		PreferredVisualization: "nodeGraph",
	}

	// Create edges frame
	mainStatField := data.NewField("mainstat", nil, []int64{})
	mainStatField.Config = &data.FieldConfig{
		DisplayName: "Call count",
	}
	edgesFrame := data.NewFrame(refID+"_edges",
		data.NewField("id", nil, []string{}),
		data.NewField("source", nil, []string{}),
		data.NewField("target", nil, []string{}),
		mainStatField,
	)

	edgesFrame.Meta = &data.FrameMeta{
		PreferredVisualization: "nodeGraph",
	}

	// Return early if there are no dependencies
	if len(dependencies.Data) == 0 {
		return []*data.Frame{nodesFrame, edgesFrame}
	}

	// Create a map to store unique service nodes
	servicesByName := make(map[string]bool)

	// Process each dependency
	for _, dependency := range dependencies.Data {
		// Add services to the map to track unique services
		servicesByName[dependency.Parent] = true
		servicesByName[dependency.Child] = true

		// Add edge data
		edgesFrame.AppendRow(
			dependency.Parent+"--"+dependency.Child,
			dependency.Parent,
			dependency.Child,
			int64(dependency.CallCount),
		)
	}

	// Convert map keys to slice and sort them - this is to ensure the returned nodes are in a consistent order
	services := make([]string, 0, len(servicesByName))
	for service := range servicesByName {
		services = append(services, service)
	}
	sort.Strings(services)

	// Add node data in sorted order
	for _, service := range services {
		nodesFrame.AppendRow(
			service,
			service,
		)
	}

	return []*data.Frame{nodesFrame, edgesFrame}
}

type TraceKeyValuePair struct {
	Key   string      `json:"key"`
	Type  string      `json:"type"`
	Value interface{} `json:"value"`
}

type TraceProcess struct {
	ServiceName string              `json:"serviceName"`
	Tags        []TraceKeyValuePair `json:"tags"`
}

type TraceSpanReference struct {
	RefType string `json:"refType"`
	SpanID  string `json:"spanID"`
	TraceID string `json:"traceID"`
}

type TraceLog struct {
	// Millisecond epoch time
	Timestamp int64               `json:"timestamp"`
	Fields    []TraceKeyValuePair `json:"fields"`
	Name      string              `json:"name"`
}

type Span struct {
	TraceID       string `json:"traceID"`
	SpanID        string `json:"spanID"`
	ProcessID     string `json:"processID"`
	OperationName string `json:"operationName"`
	// Times are in microseconds
	StartTime   int64                `json:"startTime"`
	Duration    int64                `json:"duration"`
	Logs        []TraceLog           `json:"logs"`
	References  []TraceSpanReference `json:"references"`
	Tags        []TraceKeyValuePair  `json:"tags"`
	Warnings    []string             `json:"warnings"`
	Flags       int                  `json:"flags"`
	StackTraces []string             `json:"stackTraces"`
}

type TraceResponse struct {
	Processes map[string]TraceProcess `json:"processes"`
	TraceID   string                  `json:"traceID"`
	Warnings  []string                `json:"warnings"`
	Spans     []Span                  `json:"spans"`
}

type TracesResponse struct {
	Data   []TraceResponse `json:"data"`
	Errors interface{}     `json:"errors"` // TODO: Handle errors, but we were not using them in the frontend either
	Limit  int             `json:"limit"`
	Offset int             `json:"offset"`
	Total  int             `json:"total"`
}
