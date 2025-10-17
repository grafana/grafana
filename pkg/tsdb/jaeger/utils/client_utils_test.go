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

func TestTransformTraceResponse(t *testing.T) {
	t.Run("simple_trace", func(t *testing.T) {
		trace := types.TraceResponse{
			TraceID: "3fa414edcef6ad90",
			Spans: []types.Span{
				{
					TraceID:       "3fa414edcef6ad90",
					SpanID:        "3fa414edcef6ad90",
					OperationName: "HTTP GET - api_traces_traceid",
					StartTime:     1605873894680409,
					Duration:      1049141,
					Tags: []types.KeyValueType{
						{Key: "sampler.type", Type: "string", Value: "probabilistic"},
						{Key: "sampler.param", Type: "float64", Value: 1},
					},
					Logs:      []types.TraceLog{},
					ProcessID: "p1",
					Warnings:  nil,
					Flags:     0,
				},
				{
					TraceID:       "3fa414edcef6ad90",
					SpanID:        "0f5c1808567e4403",
					OperationName: "/tempopb.Querier/FindTraceByID",
					References: []types.TraceSpanReference{
						{
							RefType: "CHILD_OF",
							TraceID: "3fa414edcef6ad90",
							SpanID:  "3fa414edcef6ad90",
						},
					},
					StartTime: 1605873894680587,
					Duration:  1847,
					Tags: []types.KeyValueType{
						{Key: "component", Type: "string", Value: "gRPC"},
						{Key: "span.kind", Type: "string", Value: "client"},
					},
					Logs:      []types.TraceLog{},
					ProcessID: "p1",
					Warnings:  nil,
					Flags:     0,
				},
			},
			Processes: map[string]types.TraceProcess{
				"p1": {
					ServiceName: "tempo-querier",
					Tags: []types.KeyValueType{
						{Key: "cluster", Type: "string", Value: "ops-tools1"},
						{Key: "container", Type: "string", Value: "tempo-query"},
					},
				},
			},
			Warnings: nil,
		}

		frame := TransformTraceResponse(trace, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "simple_trace.golden", frame, false)
	})

	t.Run("complex_trace", func(t *testing.T) {
		trace := types.TraceResponse{
			TraceID: "3fa414edcef6ad90",
			Spans: []types.Span{
				{
					TraceID:       "3fa414edcef6ad90",
					SpanID:        "3fa414edcef6ad90",
					OperationName: "HTTP GET - api_traces_traceid",
					References:    []types.TraceSpanReference{},
					StartTime:     1605873894680409,
					Duration:      1049141,
					Tags: []types.KeyValueType{
						{Key: "sampler.type", Type: "string", Value: "probabilistic"},
						{Key: "sampler.param", Type: "float64", Value: 1},
						{Key: "error", Type: "bool", Value: true},
						{Key: "http.status_code", Type: "int", Value: 500},
					},
					Logs: []types.TraceLog{
						{
							Timestamp: 1605873894681000,
							Fields: []types.KeyValueType{
								{Key: "event", Type: "string", Value: "error"},
								{Key: "message", Type: "string", Value: "Internal server error"},
							},
						},
					},
					ProcessID: "p1",
					Warnings:  []string{"High latency detected", "Error rate above threshold"},
					Flags:     0,
				},
				{
					TraceID:       "3fa414edcef6ad90",
					SpanID:        "0f5c1808567e4403",
					OperationName: "/tempopb.Querier/FindTraceByID",
					References: []types.TraceSpanReference{
						{
							RefType: "CHILD_OF",
							TraceID: "3fa414edcef6ad90",
							SpanID:  "3fa414edcef6ad90",
						},
					},
					StartTime: 1605873894680587,
					Duration:  1847,
					Tags: []types.KeyValueType{
						{Key: "component", Type: "string", Value: "gRPC"},
						{Key: "span.kind", Type: "string", Value: "client"},
						{Key: "error", Type: "bool", Value: true},
						{Key: "grpc.status_code", Type: "int", Value: 13},
					},
					Logs: []types.TraceLog{
						{
							Timestamp: 1605873894680700,
							Fields: []types.KeyValueType{
								{Key: "event", Type: "string", Value: "error"},
								{Key: "message", Type: "string", Value: "gRPC error: INTERNAL"},
							},
						},
					},
					ProcessID: "p1",
					Warnings:  []string{"gRPC call failed", "Retry attempt 3"},
					Flags:     0,
				},
				{
					TraceID:       "3fa414edcef6ad90",
					SpanID:        "1a2b3c4d5e6f7g8h",
					OperationName: "db.query",
					References: []types.TraceSpanReference{
						{
							RefType: "CHILD_OF",
							TraceID: "3fa414edcef6ad90",
							SpanID:  "0f5c1808567e4403",
						},
					},
					StartTime: 1605873894680800,
					Duration:  500,
					Tags: []types.KeyValueType{
						{Key: "db.type", Type: "string", Value: "postgresql"},
						{Key: "db.statement", Type: "string", Value: "SELECT * FROM traces WHERE id = $1"},
						{Key: "error", Type: "bool", Value: true},
					},
					Logs: []types.TraceLog{
						{
							Timestamp: 1605873894680850,
							Fields: []types.KeyValueType{
								{Key: "event", Type: "string", Value: "error"},
								{Key: "message", Type: "string", Value: "Database connection timeout"},
							},
						},
					},
					ProcessID: "p2",
					Warnings:  []string{"Database connection slow", "Query timeout"},
					Flags:     0,
				},
			},
			Processes: map[string]types.TraceProcess{
				"p1": {
					ServiceName: "tempo-querier",
					Tags: []types.KeyValueType{
						{Key: "cluster", Type: "string", Value: "ops-tools1"},
						{Key: "container", Type: "string", Value: "tempo-query"},
						{Key: "version", Type: "string", Value: "1.2.3"},
					},
				},
				"p2": {
					ServiceName: "tempo-storage",
					Tags: []types.KeyValueType{
						{Key: "cluster", Type: "string", Value: "ops-tools1"},
						{Key: "container", Type: "string", Value: "tempo-storage"},
						{Key: "version", Type: "string", Value: "2.0.1"},
					},
				},
			},
			Warnings: []string{"Trace contains errors", "Multiple service failures"},
		}

		frame := TransformTraceResponse(trace, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "complex_trace.golden", frame, false)
	})
}
