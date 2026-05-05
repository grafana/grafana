package utils

import (
	"compress/flate"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"time"

	"github.com/andybalholm/brotli"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/jaeger/types"
)

func TransformSearchResponse(response []types.TraceResponse, dsUID string, dsName string) *data.Frame {
	// Create a frame for the traces
	frame := data.NewFrame("traces",
		data.NewField("traceID", nil, []string{}).SetConfig(&data.FieldConfig{
			DisplayName: "Trace ID",
			Links: []data.DataLink{
				{
					Title: "Trace: ${__value.raw}",
					URL:   "",
					Internal: &data.InternalDataLink{
						DatasourceUID:  dsUID,
						DatasourceName: dsName,
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

func TransformTraceResponse(trace types.TraceResponse, refID string) *data.Frame {
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

		// Convert logs — timestamps from microseconds to milliseconds
		logs := json.RawMessage{}
		convertedLogs := make([]types.TraceLog, len(span.Logs))
		for i, l := range span.Logs {
			convertedLogs[i] = l
			convertedLogs[i].Timestamp = l.Timestamp / 1000
		}
		logsMarshaled, err := json.Marshal(convertedLogs)
		if err == nil {
			logs = json.RawMessage(logsMarshaled)
		}

		// Convert references (excluding parent)
		references := json.RawMessage{}
		filteredRefs := []types.TraceSpanReference{}
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

// Decode reads and decompresses the body based on Content-Encoding (gzip, deflate, br, or none).
func Decode(encoding string, original io.ReadCloser) ([]byte, error) {
	var reader io.Reader
	var err error
	switch encoding {
	case "gzip":
		reader, err = gzip.NewReader(original)
		if err != nil {
			return nil, err
		}
		defer func() {
			if err := reader.(io.ReadCloser).Close(); err != nil {
				backend.Logger.Warn("Failed to close reader body", "err", err)
			}
		}()
	case "deflate":
		reader = flate.NewReader(original)
		defer func() {
			if err := reader.(io.ReadCloser).Close(); err != nil {
				backend.Logger.Warn("Failed to close reader body", "err", err)
			}
		}()
	case "br":
		reader = brotli.NewReader(original)
	case "":
		reader = original
	default:
		return nil, fmt.Errorf("unexpected encoding type %q", encoding)
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	return body, nil
}
