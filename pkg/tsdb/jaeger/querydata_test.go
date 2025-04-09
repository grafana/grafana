package jaeger

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
)

func TestTransformTraceResponse(t *testing.T) {
	t.Run("simple_trace", func(t *testing.T) {
		trace := TraceResponse{
			TraceID: "3fa414edcef6ad90",
			Spans: []Span{
				{
					TraceID:       "3fa414edcef6ad90",
					SpanID:        "3fa414edcef6ad90",
					OperationName: "HTTP GET - api_traces_traceid",
					StartTime:     1605873894680409,
					Duration:      1049141,
					Tags: []TraceKeyValuePair{
						{Key: "sampler.type", Type: "string", Value: "probabilistic"},
						{Key: "sampler.param", Type: "float64", Value: 1},
					},
					Logs:      []TraceLog{},
					ProcessID: "p1",
					Warnings:  nil,
					Flags:     0,
				},
				{
					TraceID:       "3fa414edcef6ad90",
					SpanID:        "0f5c1808567e4403",
					OperationName: "/tempopb.Querier/FindTraceByID",
					References: []TraceSpanReference{
						{
							RefType: "CHILD_OF",
							TraceID: "3fa414edcef6ad90",
							SpanID:  "3fa414edcef6ad90",
						},
					},
					StartTime: 1605873894680587,
					Duration:  1847,
					Tags: []TraceKeyValuePair{
						{Key: "component", Type: "string", Value: "gRPC"},
						{Key: "span.kind", Type: "string", Value: "client"},
					},
					Logs:      []TraceLog{},
					ProcessID: "p1",
					Warnings:  nil,
					Flags:     0,
				},
			},
			Processes: map[string]TraceProcess{
				"p1": {
					ServiceName: "tempo-querier",
					Tags: []TraceKeyValuePair{
						{Key: "cluster", Type: "string", Value: "ops-tools1"},
						{Key: "container", Type: "string", Value: "tempo-query"},
					},
				},
			},
			Warnings: nil,
		}

		frame := transformTraceResponse(trace, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "simple_trace.golden", frame, false)
	})

	t.Run("complex_trace", func(t *testing.T) {
		trace := TraceResponse{
			TraceID: "3fa414edcef6ad90",
			Spans: []Span{
				{
					TraceID:       "3fa414edcef6ad90",
					SpanID:        "3fa414edcef6ad90",
					OperationName: "HTTP GET - api_traces_traceid",
					References:    []TraceSpanReference{},
					StartTime:     1605873894680409,
					Duration:      1049141,
					Tags: []TraceKeyValuePair{
						{Key: "sampler.type", Type: "string", Value: "probabilistic"},
						{Key: "sampler.param", Type: "float64", Value: 1},
						{Key: "error", Type: "bool", Value: true},
						{Key: "http.status_code", Type: "int", Value: 500},
					},
					Logs: []TraceLog{
						{
							Timestamp: 1605873894681000,
							Fields: []TraceKeyValuePair{
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
					References: []TraceSpanReference{
						{
							RefType: "CHILD_OF",
							TraceID: "3fa414edcef6ad90",
							SpanID:  "3fa414edcef6ad90",
						},
					},
					StartTime: 1605873894680587,
					Duration:  1847,
					Tags: []TraceKeyValuePair{
						{Key: "component", Type: "string", Value: "gRPC"},
						{Key: "span.kind", Type: "string", Value: "client"},
						{Key: "error", Type: "bool", Value: true},
						{Key: "grpc.status_code", Type: "int", Value: 13},
					},
					Logs: []TraceLog{
						{
							Timestamp: 1605873894680700,
							Fields: []TraceKeyValuePair{
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
					References: []TraceSpanReference{
						{
							RefType: "CHILD_OF",
							TraceID: "3fa414edcef6ad90",
							SpanID:  "0f5c1808567e4403",
						},
					},
					StartTime: 1605873894680800,
					Duration:  500,
					Tags: []TraceKeyValuePair{
						{Key: "db.type", Type: "string", Value: "postgresql"},
						{Key: "db.statement", Type: "string", Value: "SELECT * FROM traces WHERE id = $1"},
						{Key: "error", Type: "bool", Value: true},
					},
					Logs: []TraceLog{
						{
							Timestamp: 1605873894680850,
							Fields: []TraceKeyValuePair{
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
			Processes: map[string]TraceProcess{
				"p1": {
					ServiceName: "tempo-querier",
					Tags: []TraceKeyValuePair{
						{Key: "cluster", Type: "string", Value: "ops-tools1"},
						{Key: "container", Type: "string", Value: "tempo-query"},
						{Key: "version", Type: "string", Value: "1.2.3"},
					},
				},
				"p2": {
					ServiceName: "tempo-storage",
					Tags: []TraceKeyValuePair{
						{Key: "cluster", Type: "string", Value: "ops-tools1"},
						{Key: "container", Type: "string", Value: "tempo-storage"},
						{Key: "version", Type: "string", Value: "2.0.1"},
					},
				},
			},
			Warnings: []string{"Trace contains errors", "Multiple service failures"},
		}

		frame := transformTraceResponse(trace, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "complex_trace.golden", frame, false)
	})
}
