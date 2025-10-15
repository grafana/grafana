package utils

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/tsdb/jaeger/types"
	"github.com/stretchr/testify/assert"
)

func TestTransformGrpcSearchResponse(t *testing.T) {
	t.Run("empty_response", func(t *testing.T) {
		frame := TransformGrpcSearchResponse(types.GrpcTracesResult{}, "test-uid", "test-name", 0)
		experimental.CheckGoldenJSONFrame(t, "../testdata", "search_empty_response.golden", frame, false)
	})

	t.Run("single_trace", func(t *testing.T) {
		response := types.GrpcTracesResult{
			ResourceSpans: []types.GrpcResourceSpans{
				{
					Resource: types.GrpcResource{
						Attributes: []types.GrpcKeyValue{
							{
								Key: "service.name",
								Value: types.GrpcAnyValue{
									StringValue: "test-service",
								},
							},
						},
					},
					ScopeSpans: []types.GrpcScopeSpans{
						{
							Spans: []types.GrpcSpan{
								{
									TraceID:           "test-trace-id",
									Name:              "test-operation",
									StartTimeUnixNano: "1605873894680409000",
									EndTimeUnixNano:   "1605873894681409000",
								},
							},
						},
					},
					SchemaURL: "someschemaurl.com",
				},
			},
		}

		frame := TransformGrpcSearchResponse(response, "test-uid", "test-name", 0)
		experimental.CheckGoldenJSONFrame(t, "../testdata", "search_single_response.golden", frame, false)
	})

	t.Run("multiple_traces", func(t *testing.T) {
		response := types.GrpcTracesResult{
			ResourceSpans: []types.GrpcResourceSpans{
				{
					Resource: types.GrpcResource{
						Attributes: []types.GrpcKeyValue{
							{
								Key: "service.name",
								Value: types.GrpcAnyValue{
									StringValue: "service-1",
								},
							},
						},
					},
					ScopeSpans: []types.GrpcScopeSpans{
						{
							Spans: []types.GrpcSpan{
								{
									TraceID:           "trace-1",
									Name:              "op1",
									StartTimeUnixNano: "1605873894680409000",
									EndTimeUnixNano:   "1605873894681409000",
								},
							},
						},
					},
					SchemaURL: "someschemaurl.com",
				},
				{
					Resource: types.GrpcResource{
						Attributes: []types.GrpcKeyValue{
							{
								Key: "service.name",
								Value: types.GrpcAnyValue{
									StringValue: "service-2",
								},
							},
						},
					},
					ScopeSpans: []types.GrpcScopeSpans{
						{
							Spans: []types.GrpcSpan{
								{
									TraceID:           "trace-2",
									Name:              "op2",
									StartTimeUnixNano: "1605873894680409000",
									EndTimeUnixNano:   "1605873894682409000",
								},
							},
						},
					},
					SchemaURL: "someschemaurl.com",
				},
			},
		}
		frame := TransformGrpcSearchResponse(response, "test-uid", "test-name", 0)
		experimental.CheckGoldenJSONFrame(t, "../testdata", "search_multiple_response.golden", frame, false)
	})
}
func TestGetAttributes(t *testing.T) {
	testAttributes := []types.GrpcKeyValue{
		{
			Key: "some-key1",
			Value: types.GrpcAnyValue{
				StringValue: "some-stringValue1",
			},
		},
		{
			Key: "some-key2",
			Value: types.GrpcAnyValue{
				BoolValue: "true",
			},
		},
		{
			Key: "some-key3",
			Value: types.GrpcAnyValue{
				IntValue: "0",
			},
		},
		{
			Key: "some-key4",
			Value: types.GrpcAnyValue{
				DoubleValue: "0",
			},
		},
		{
			Key: "some-key5",
			Value: types.GrpcAnyValue{
				ArrayValue: types.GrpcArrayValue{
					Values: []types.GrpcAnyValue{},
				},
			},
		},
		{
			Key: "some-key6",
			Value: types.GrpcAnyValue{
				KvListValue: types.KeyValueList{
					Values: []types.GrpcKeyValue{},
				},
			},
		},
		{
			Key: "some-key7",
			Value: types.GrpcAnyValue{
				BytesValue: "somebytesvalue",
			},
		},
	}
	t.Run("handles StringValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key1")
		assert.Equal(t, types.GrpcAnyValue{
			StringValue: "some-stringValue1",
		}, actual)
	})
	t.Run("handles BoolValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key2")
		assert.Equal(t, types.GrpcAnyValue{
			BoolValue: "true",
		}, actual)
	})
	t.Run("handles IntValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key3")
		assert.Equal(t, types.GrpcAnyValue{
			IntValue: "0",
		}, actual)
	})
	t.Run("handles DoubleValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key4")
		assert.Equal(t, types.GrpcAnyValue{
			DoubleValue: "0",
		}, actual)
	})
	t.Run("handles ArrayValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key5")
		assert.Equal(t, types.GrpcAnyValue{
			ArrayValue: types.GrpcArrayValue{
				Values: []types.GrpcAnyValue{},
			},
		}, actual)
	})
	t.Run("handles KvListValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key6")
		assert.Equal(t, types.GrpcAnyValue{
			KvListValue: types.KeyValueList{
				Values: []types.GrpcKeyValue{},
			},
		}, actual)
	})
	t.Run("handles BytesValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key7")
		assert.Equal(t, types.GrpcAnyValue{
			BytesValue: "somebytesvalue",
		}, actual)
	})
	t.Run("handles non-existent value", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key8")
		assert.Equal(t, types.GrpcAnyValue{}, actual)
	})
}

// func TestTransformGrpcTraceResponse(t *testing.T) {
// 	t.Run("simple_trace", func(t *testing.T) {
// 		trace := types.GrpcResourceSpans{
// 			Resource: types.GrpcResource{
// 				Attributes: []types.GrpcKeyValue{
// 					{
// 						Key: "service.name",
// 						Value: types.GrpcAnyValue{
// 							StringValue: "tempo-querier",
// 						},
// 					},
// 					{
// 						Key: "cluster",
// 						Value: types.GrpcAnyValue{
// 							StringValue: "ops-tools1",
// 						},
// 					},
// 					{
// 						Key: "container",
// 						Value: types.GrpcAnyValue{
// 							StringValue: "tempo-query",
// 						},
// 					},
// 				},
// 			},
// 			ScopeSpans: []types.GrpcScopeSpans{
// 				{
// 					Scope: types.GrpcInstrumentationScope{
// 						Name: "some_scope1",
// 						Version: "0.0.39",
// 					},
// 					Spans: []types.GrpcSpan{
// 						{
// 							TraceID: "3fa414edcef6ad90",
// 							SpanID: "3fa414edcef6ad90",
// 							ParentSpanID: "",
// 							Name: "HTTP GET - api_traces_traceid",
// 							Attributes: []types.GrpcKeyValue{
// 								{
// 									Key: "sampler.type",
// 									Value: types.GrpcAnyValue{
// 										StringValue: "probabilistic",
// 									},
// 								},
// 								{
// 									Key: "sampler.param",
// 									Value: types.GrpcAnyValue{
// 										DoubleValue: 1,
// 									},
// 								},
// 							},
// 							StartTimeUnixNano: "1605873894680409000",
// 							EndTimeUnixNano: "1605873895729550000",
// 						},
// 						{
// 							TraceID: "3fa414edcef6ad90",
// 							SpanID: "0f5c1808567e4403",
// 							ParentSpanID: "3fa414edcef6ad90",
// 							Name: "HTTP GET - api_traces_traceid",
// 							Attributes: []types.GrpcKeyValue{
// 								{
// 									Key: "component",
// 									Value: types.GrpcAnyValue{
// 										StringValue: "gRPC",
// 									},
// 								},
// 								{
// 									Key: "span.kind",
// 									Value: types.GrpcAnyValue{
// 										DoubleValue: "client",
// 									},
// 								},
// 							},
// 							StartTimeUnixNano: "1605873894680587000",
// 							EndTimeUnixNano: "1605873894682434000",
// 						},
// 					},
// 				},
// 			},
// 		}
// 		frame := TransformGrpcTraceResponse(trace, "test")
// 		experimental.CheckGoldenJSONFrame(t, "./testdata", "simple_trace.golden", frame, false)
// 	})

// 	t.Run("complex_trace", func(t *testing.T) {
// 		trace := types.TraceResponse{
// 			TraceID: "3fa414edcef6ad90",
// 			Spans: []types.Span{
// 				{
// 					TraceID:       "3fa414edcef6ad90",
// 					SpanID:        "3fa414edcef6ad90",
// 					OperationName: "HTTP GET - api_traces_traceid",
// 					References:    []types.TraceSpanReference{},
// 					StartTime:     1605873894680409,
// 					Duration:      1049141,
// 					Tags: []types.TraceKeyValuePair{
// 						{Key: "sampler.type", Type: "string", Value: "probabilistic"},
// 						{Key: "sampler.param", Type: "float64", Value: 1},
// 						{Key: "error", Type: "bool", Value: true},
// 						{Key: "http.status_code", Type: "int", Value: 500},
// 					},
// 					Logs: []types.TraceLog{
// 						{
// 							Timestamp: 1605873894681000,
// 							Fields: []types.TraceKeyValuePair{
// 								{Key: "event", Type: "string", Value: "error"},
// 								{Key: "message", Type: "string", Value: "Internal server error"},
// 							},
// 						},
// 					},
// 					ProcessID: "p1",
// 					Warnings:  []string{"High latency detected", "Error rate above threshold"},
// 					Flags:     0,
// 				},
// 				{
// 					TraceID:       "3fa414edcef6ad90",
// 					SpanID:        "0f5c1808567e4403",
// 					OperationName: "/tempopb.Querier/FindTraceByID",
// 					References: []types.TraceSpanReference{
// 						{
// 							RefType: "CHILD_OF",
// 							TraceID: "3fa414edcef6ad90",
// 							SpanID:  "3fa414edcef6ad90",
// 						},
// 					},
// 					StartTime: 1605873894680587,
// 					Duration:  1847,
// 					Tags: []types.TraceKeyValuePair{
// 						{Key: "component", Type: "string", Value: "gRPC"},
// 						{Key: "span.kind", Type: "string", Value: "client"},
// 						{Key: "error", Type: "bool", Value: true},
// 						{Key: "grpc.status_code", Type: "int", Value: 13},
// 					},
// 					Logs: []types.TraceLog{
// 						{
// 							Timestamp: 1605873894680700,
// 							Fields: []types.TraceKeyValuePair{
// 								{Key: "event", Type: "string", Value: "error"},
// 								{Key: "message", Type: "string", Value: "gRPC error: INTERNAL"},
// 							},
// 						},
// 					},
// 					ProcessID: "p1",
// 					Warnings:  []string{"gRPC call failed", "Retry attempt 3"},
// 					Flags:     0,
// 				},
// 				{
// 					TraceID:       "3fa414edcef6ad90",
// 					SpanID:        "1a2b3c4d5e6f7g8h",
// 					OperationName: "db.query",
// 					References: []types.TraceSpanReference{
// 						{
// 							RefType: "CHILD_OF",
// 							TraceID: "3fa414edcef6ad90",
// 							SpanID:  "0f5c1808567e4403",
// 						},
// 					},
// 					StartTime: 1605873894680800,
// 					Duration:  500,
// 					Tags: []types.TraceKeyValuePair{
// 						{Key: "db.type", Type: "string", Value: "postgresql"},
// 						{Key: "db.statement", Type: "string", Value: "SELECT * FROM traces WHERE id = $1"},
// 						{Key: "error", Type: "bool", Value: true},
// 					},
// 					Logs: []types.TraceLog{
// 						{
// 							Timestamp: 1605873894680850,
// 							Fields: []types.TraceKeyValuePair{
// 								{Key: "event", Type: "string", Value: "error"},
// 								{Key: "message", Type: "string", Value: "Database connection timeout"},
// 							},
// 						},
// 					},
// 					ProcessID: "p2",
// 					Warnings:  []string{"Database connection slow", "Query timeout"},
// 					Flags:     0,
// 				},
// 			},
// 			Processes: map[string]types.TraceProcess{
// 				"p1": {
// 					ServiceName: "tempo-querier",
// 					Tags: []types.TraceKeyValuePair{
// 						{Key: "cluster", Type: "string", Value: "ops-tools1"},
// 						{Key: "container", Type: "string", Value: "tempo-query"},
// 						{Key: "version", Type: "string", Value: "1.2.3"},
// 					},
// 				},
// 				"p2": {
// 					ServiceName: "tempo-storage",
// 					Tags: []types.TraceKeyValuePair{
// 						{Key: "cluster", Type: "string", Value: "ops-tools1"},
// 						{Key: "container", Type: "string", Value: "tempo-storage"},
// 						{Key: "version", Type: "string", Value: "2.0.1"},
// 					},
// 				},
// 			},
// 			Warnings: []string{"Trace contains errors", "Multiple service failures"},
// 		}

// 		frame := TransformTraceResponse(trace, "test")
// 		experimental.CheckGoldenJSONFrame(t, "./testdata", "complex_trace.golden", frame, false)
// 	})
// }

func TestProcessSpanKind(t *testing.T) {
	t.Run("converts unspecified span kind", func(t *testing.T) {
		actual := processSpanKind(0)
		assert.Equal(t, "unspecified", actual)
	})

	t.Run("converts internal span kind", func(t *testing.T) {
		actual := processSpanKind(1)
		assert.Equal(t, "internal", actual)
	})

	t.Run("converts server span kind", func(t *testing.T) {
		actual := processSpanKind(2)
		assert.Equal(t, "server", actual)
	})

	t.Run("converts client span kind", func(t *testing.T) {
		actual := processSpanKind(3)
		assert.Equal(t, "client", actual)
	})

	t.Run("converts producer span kind", func(t *testing.T) {
		actual := processSpanKind(4)
		assert.Equal(t, "producer", actual)
	})

	t.Run("converts consumer span kind", func(t *testing.T) {
		actual := processSpanKind(5)
		assert.Equal(t, "consumer", actual)
	})

	t.Run("converts unsupported span kind", func(t *testing.T) {
		actual := processSpanKind(10)
		assert.Equal(t, "unspecified", actual)
	})
}

func TestIsEmptyAttribute(t *testing.T) {
	t.Run("returns true for empty attribute", func(t *testing.T) {
		actual := isEmptyAttribute(types.GrpcAnyValue{})
		assert.Equal(t, true, actual)

		actual = isEmptyAttribute(types.GrpcAnyValue{
			ArrayValue:  types.GrpcArrayValue{},
			KvListValue: types.KeyValueList{},
		})
		assert.Equal(t, true, actual)
	})

	t.Run("returns false for non empty string attribute", func(t *testing.T) {
		actual := isEmptyAttribute(types.GrpcAnyValue{
			StringValue: "some non empty value",
		})
		assert.Equal(t, false, actual)
	})

	t.Run("returns false for non empty bool attribute", func(t *testing.T) {
		actual := isEmptyAttribute(types.GrpcAnyValue{
			BoolValue: "false",
		})
		assert.Equal(t, false, actual)
	})

	t.Run("returns false for non empty int attribute", func(t *testing.T) {
		actual := isEmptyAttribute(types.GrpcAnyValue{
			IntValue: "100",
		})
		assert.Equal(t, false, actual)
	})

	t.Run("returns false for non empty double attribute", func(t *testing.T) {
		actual := isEmptyAttribute(types.GrpcAnyValue{
			DoubleValue: "100.50",
		})
		assert.Equal(t, false, actual)
	})
	t.Run("returns false for non empty arrayvalue attribute", func(t *testing.T) {
		actual := isEmptyAttribute(types.GrpcAnyValue{
			ArrayValue: types.GrpcArrayValue{
				Values: []types.GrpcAnyValue{
					{
						StringValue: "some non empty value",
					},
				},
			},
		})
		assert.Equal(t, false, actual)
	})

	t.Run("returns false for non empty KvListValue attribute", func(t *testing.T) {
		actual := isEmptyAttribute(types.GrpcAnyValue{
			KvListValue: types.KeyValueList{
				Values: []types.GrpcKeyValue{
					{
						Key: "some-key",
						Value: types.GrpcAnyValue{
							IntValue: "10",
						},
					},
				},
			},
		})
		assert.Equal(t, false, actual)
	})

	t.Run("returns false for non empty bytesvalue attribute", func(t *testing.T) {
		actual := isEmptyAttribute(types.GrpcAnyValue{
			BytesValue: "somebytesvalue",
		})
		assert.Equal(t, false, actual)
	})
}

func TestProcessAttributesIntoTags(t *testing.T) {

	t.Run("processes empty attributes", func(t *testing.T) {
		actual := processAttributesIntoTags([]types.GrpcKeyValue{})
		assert.Equal(t, []types.KeyValueType{}, actual)
	})
	t.Run("processes string attribute types", func(t *testing.T) {
		attributes := []types.GrpcKeyValue{
			{
				Key: "key1",
				Value: types.GrpcAnyValue{
					StringValue: "value1",
				},
			},
		}
		expected := []types.KeyValueType{
			{
				Key:   "key1",
				Value: "value1",
				Type:  "string",
			},
		}
		actual := processAttributesIntoTags(attributes)
		assert.Equal(t, expected, actual)
	})

	t.Run("processes bool attribute types", func(t *testing.T) {
		attributes := []types.GrpcKeyValue{
			{
				Key: "key1",
				Value: types.GrpcAnyValue{
					BoolValue: "true",
				},
			},
		}
		expected := []types.KeyValueType{
			{
				Key:   "key1",
				Value: true,
				Type:  "boolean",
			},
		}
		actual := processAttributesIntoTags(attributes)
		assert.Equal(t, expected, actual)
	})

	t.Run("processes int attribute types", func(t *testing.T) {
		attributes := []types.GrpcKeyValue{
			{
				Key: "key1",
				Value: types.GrpcAnyValue{
					IntValue: "10",
				},
			},
		}
		expected := []types.KeyValueType{
			{
				Key:   "key1",
				Value: int64(10),
				Type:  "int64",
			},
		}
		actual := processAttributesIntoTags(attributes)
		assert.Equal(t, expected, actual)
	})

	t.Run("processes double attribute types", func(t *testing.T) {
		attributes := []types.GrpcKeyValue{
			{
				Key: "key1",
				Value: types.GrpcAnyValue{
					DoubleValue: "100.50",
				},
			},
		}
		expected := []types.KeyValueType{
			{
				Key:   "key1",
				Value: float64(100.50),
				Type:  "float64",
			},
		}
		actual := processAttributesIntoTags(attributes)
		assert.Equal(t, expected, actual)
	})

	t.Run("processes arrayvalue attribute types", func(t *testing.T) {
		attributes := []types.GrpcKeyValue{
			{
				Key: "key1",
				Value: types.GrpcAnyValue{
					ArrayValue: types.GrpcArrayValue{
						Values: []types.GrpcAnyValue{
							{
								StringValue: "value1",
							},
						},
					},
				},
			},
		}
		expected := []types.KeyValueType{
			{
				Key: "key1",
				Value: []types.GrpcAnyValue{
					{
						StringValue: "value1",
					},
				},
			},
		}
		actual := processAttributesIntoTags(attributes)
		assert.Equal(t, expected, actual)
	})

	t.Run("processes kvlistvalue attribute types", func(t *testing.T) {
		attributes := []types.GrpcKeyValue{
			{
				Key: "key1",
				Value: types.GrpcAnyValue{
					KvListValue: types.KeyValueList{
						Values: []types.GrpcKeyValue{
							{
								Key: "key2",
								Value: types.GrpcAnyValue{
									StringValue: "value2",
								},
							},
						},
					},
				},
			},
		}
		expected := []types.KeyValueType{
			{
				Key: "key1",
				Value: []types.GrpcKeyValue{
					{
						Key: "key2",
						Value: types.GrpcAnyValue{
							StringValue: "value2",
						},
					},
				},
			},
		}
		actual := processAttributesIntoTags(attributes)
		assert.Equal(t, expected, actual)
	})

	t.Run("processes bytes attribute types", func(t *testing.T) {
		attributes := []types.GrpcKeyValue{
			{
				Key: "key1",
				Value: types.GrpcAnyValue{
					BytesValue: "bytesvalue1",
				},
			},
		}
		expected := []types.KeyValueType{
			{
				Key:   "key1",
				Value: "bytesvalue1",
				Type:  "bytes",
			},
		}
		actual := processAttributesIntoTags(attributes)
		assert.Equal(t, expected, actual)
	})
}
