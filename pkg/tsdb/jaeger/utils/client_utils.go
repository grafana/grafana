package utils

import (
	"fmt"
	"sort"
	"time"

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
