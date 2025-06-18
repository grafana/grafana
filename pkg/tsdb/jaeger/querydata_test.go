package jaeger

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
)

func TestTransformSearchResponse(t *testing.T) {
	t.Run("empty_response", func(t *testing.T) {
		dsInfo := &datasourceInfo{
			JaegerClient: JaegerClient{
				settings: backend.DataSourceInstanceSettings{
					UID:  "test-uid",
					Name: "test-name",
				},
			},
		}

		frame := transformSearchResponse([]TraceResponse{}, dsInfo)
		experimental.CheckGoldenJSONFrame(t, "./testdata", "search_empty_response.golden", frame, false)
	})

	t.Run("single_trace", func(t *testing.T) {
		dsInfo := &datasourceInfo{
			JaegerClient: JaegerClient{
				settings: backend.DataSourceInstanceSettings{
					UID:  "test-uid",
					Name: "test-name",
				},
			},
		}

		response := []TraceResponse{
			{
				TraceID: "test-trace-id",
				Spans: []Span{
					{
						TraceID:       "test-trace-id",
						ProcessID:     "p1",
						OperationName: "test-operation",
						StartTime:     1605873894680409,
						Duration:      1000,
					},
				},
				Processes: map[string]TraceProcess{
					"p1": {
						ServiceName: "test-service",
					},
				},
			},
		}

		frame := transformSearchResponse(response, dsInfo)
		experimental.CheckGoldenJSONFrame(t, "./testdata", "search_single_response.golden", frame, false)
	})

	t.Run("multiple_traces", func(t *testing.T) {
		dsInfo := &datasourceInfo{
			JaegerClient: JaegerClient{
				settings: backend.DataSourceInstanceSettings{
					UID:  "test-uid",
					Name: "test-name",
				},
			},
		}

		response := []TraceResponse{
			{
				TraceID: "trace-1",
				Spans: []Span{
					{
						TraceID:       "trace-1",
						ProcessID:     "p1",
						OperationName: "op1",
						StartTime:     1605873894680409,
						Duration:      1000,
					},
				},
				Processes: map[string]TraceProcess{
					"p1": {
						ServiceName: "service-1",
					},
				},
			},
			{
				TraceID: "trace-2",
				Spans: []Span{
					{
						TraceID:       "trace-2",
						ProcessID:     "p2",
						OperationName: "op2",
						StartTime:     1605873894680409,
						Duration:      2000,
					},
				},
				Processes: map[string]TraceProcess{
					"p2": {
						ServiceName: "service-2",
					},
				},
			},
		}

		frame := transformSearchResponse(response, dsInfo)
		experimental.CheckGoldenJSONFrame(t, "./testdata", "search_multiple_response.golden", frame, false)
	})
}

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

func TestTransformDependenciesResponse(t *testing.T) {
	t.Run("simple_dependencies", func(t *testing.T) {
		dependencies := DependenciesResponse{
			Data: []ServiceDependency{
				{
					Parent:    "serviceA",
					Child:     "serviceB",
					CallCount: 1,
				},
				{
					Parent:    "serviceA",
					Child:     "serviceC",
					CallCount: 2,
				},
				{
					Parent:    "serviceB",
					Child:     "serviceC",
					CallCount: 3,
				},
			},
		}

		frames := transformDependenciesResponse(dependencies, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "simple_dependencies_nodes.golden", frames[0], false)
		experimental.CheckGoldenJSONFrame(t, "./testdata", "simple_dependencies_edges.golden", frames[1], false)
	})

	t.Run("empty_dependencies", func(t *testing.T) {
		dependencies := DependenciesResponse{
			Data: []ServiceDependency{},
		}

		frames := transformDependenciesResponse(dependencies, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "empty_dependencies_nodes.golden", frames[0], false)
		experimental.CheckGoldenJSONFrame(t, "./testdata", "empty_dependencies_edges.golden", frames[1], false)
	})

	t.Run("complex_dependencies", func(t *testing.T) {
		dependencies := DependenciesResponse{
			Data: []ServiceDependency{
				{
					Parent:    "frontend",
					Child:     "auth-service",
					CallCount: 150,
				},
				{
					Parent:    "frontend",
					Child:     "api-gateway",
					CallCount: 300,
				},
				{
					Parent:    "api-gateway",
					Child:     "user-service",
					CallCount: 200,
				},
				{
					Parent:    "api-gateway",
					Child:     "order-service",
					CallCount: 100,
				},
				{
					Parent:    "order-service",
					Child:     "payment-service",
					CallCount: 80,
				},
				{
					Parent:    "order-service",
					Child:     "inventory-service",
					CallCount: 90,
				},
				{
					Parent:    "user-service",
					Child:     "database",
					CallCount: 500,
				},
				{
					Parent:    "payment-service",
					Child:     "database",
					CallCount: 200,
				},
				{
					Parent:    "inventory-service",
					Child:     "database",
					CallCount: 300,
				},
			},
		}

		frames := transformDependenciesResponse(dependencies, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "complex_dependencies_nodes.golden", frames[0], false)
		experimental.CheckGoldenJSONFrame(t, "./testdata", "complex_dependencies_edges.golden", frames[1], false)
	})
}
