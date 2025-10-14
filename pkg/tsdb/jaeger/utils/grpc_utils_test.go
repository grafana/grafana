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
			ResourceSpans: []types.GrpcRresourceSpans{
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
			ResourceSpans: []types.GrpcRresourceSpans{
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
		assert.Equal(t, actual, types.GrpcAnyValue{
			StringValue: "some-stringValue1",
		})
	})
	t.Run("handles BoolValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key2")
		assert.Equal(t, actual, types.GrpcAnyValue{
			BoolValue: "true",
		})
	})
	t.Run("handles IntValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key3")
		assert.Equal(t, actual, types.GrpcAnyValue{
			IntValue: "0",
		})
	})
	t.Run("handles DoubleValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key4")
		assert.Equal(t, actual, types.GrpcAnyValue{
			DoubleValue: "0",
		})
	})
	t.Run("handles ArrayValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key5")
		assert.Equal(t, actual, types.GrpcAnyValue{
			ArrayValue: types.GrpcArrayValue{
				Values: []types.GrpcAnyValue{},
			},
		})
	})
	t.Run("handles KvListValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key6")
		assert.Equal(t, actual, types.GrpcAnyValue{
			KvListValue: types.KeyValueList{
				Values: []types.GrpcKeyValue{},
			},
		})
	})
	t.Run("handles BytesValue", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key7")
		assert.Equal(t, actual, types.GrpcAnyValue{
			BytesValue: "somebytesvalue",
		})
	})
	t.Run("handles non-existent value", func(t *testing.T) {
		actual := getAttribute(testAttributes, "some-key8")
		assert.Equal(t, actual, types.GrpcAnyValue{})
	})
}
