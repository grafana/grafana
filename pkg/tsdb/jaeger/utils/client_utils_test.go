package utils

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/tsdb/jaeger/types"
)

func TestTransformSearchResponse(t *testing.T) {
	t.Run("empty_response", func(t *testing.T) {
		frame := TransformSearchResponse([]types.TraceResponse{}, "test-uid", "test-name")
		experimental.CheckGoldenJSONFrame(t, "../testdata", "search_empty_response.golden", frame, false)
	})

	t.Run("single_trace", func(t *testing.T) {
		response := []types.TraceResponse{
			{
				TraceID: "test-trace-id",
				Spans: []types.Span{
					{
						TraceID:       "test-trace-id",
						ProcessID:     "p1",
						OperationName: "test-operation",
						StartTime:     1605873894680409,
						Duration:      1000,
					},
				},
				Processes: map[string]types.TraceProcess{
					"p1": {
						ServiceName: "test-service",
					},
				},
			},
		}

		frame := TransformSearchResponse(response, "test-uid", "test-name")
		experimental.CheckGoldenJSONFrame(t, "../testdata", "search_single_response.golden", frame, false)
	})

	t.Run("multiple_traces", func(t *testing.T) {
		response := []types.TraceResponse{
			{
				TraceID: "trace-1",
				Spans: []types.Span{
					{
						TraceID:       "trace-1",
						ProcessID:     "p1",
						OperationName: "op1",
						StartTime:     1605873894680409,
						Duration:      1000,
					},
				},
				Processes: map[string]types.TraceProcess{
					"p1": {
						ServiceName: "service-1",
					},
				},
			},
			{
				TraceID: "trace-2",
				Spans: []types.Span{
					{
						TraceID:       "trace-2",
						ProcessID:     "p2",
						OperationName: "op2",
						StartTime:     1605873894680409,
						Duration:      2000,
					},
				},
				Processes: map[string]types.TraceProcess{
					"p2": {
						ServiceName: "service-2",
					},
				},
			},
		}

		frame := TransformSearchResponse(response, "test-uid", "test-name")
		experimental.CheckGoldenJSONFrame(t, "../testdata", "search_multiple_response.golden", frame, false)
	})
}
