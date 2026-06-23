package tempo

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
	v1 "github.com/grafana/tempo/pkg/tempopb/common/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateSearchRequest(t *testing.T) {
	datasource := &DatasourceInfo{URL: "http://localhost:3200"}
	var qstring = "{service.name=\"svc\"}"
	var limit int64 = 10
	var spss int64 = 3

	query := &dataquery.TempoQuery{Query: &qstring, Limit: &limit, Spss: &spss}
	req, err := createSearchRequest(context.Background(), datasource, query, 100, 200)
	require.NoError(t, err)

	assert.Equal(t, `{service.name="svc"}`, req.URL.Query().Get("q"))
	assert.Equal(t, "10", req.URL.Query().Get("limit"))
	assert.Equal(t, "3", req.URL.Query().Get("spss"))
	assert.Equal(t, "100", req.URL.Query().Get("start"))
	assert.Equal(t, "200", req.URL.Query().Get("end"))
}

func TestTransformTraceSearchResponse(t *testing.T) {
	pCtx := backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "u", Name: "n"}}
	resp := &tempopb.SearchResponse{Traces: []*tempopb.TraceSearchMetadata{{
		TraceID:           "test-trace-id-x",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: 2000000,
		DurationMs:        5,
		SpanSet:           &tempopb.SpanSet{Spans: []*tempopb.Span{{SpanID: "span1", Name: "op", StartTimeUnixNano: 1000000, DurationNanos: 1000}}},
	}, {
		TraceID:           "test-trace-id-y",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: 1000000,
		DurationMs:        10,
		SpanSet: &tempopb.SpanSet{
			Spans: []*tempopb.Span{
				{
					SpanID:            "span1",
					Name:              "op",
					StartTimeUnixNano: 1000000,
					DurationNanos:     1000,
					Attributes:        []*v1.KeyValue{{Key: "http.method", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "GET"}}}},
				},
				{
					SpanID:            "span2",
					Name:              "op",
					StartTimeUnixNano: 1000000,
					DurationNanos:     1000,
				},
			},
		},
	}}}

	frames, err := transformTraceSearchResponse(pCtx, resp)
	require.NoError(t, err)
	require.Len(t, frames, 1)

	assert.Equal(t, 2, frames[0].Rows())
	assert.Equal(t, "test-trace-id-x", frames[0].Fields[0].At(0))
	assert.Equal(t, "test-trace-id-y", frames[0].Fields[0].At(1))
	assert.Equal(t, time.Unix(0, 2000000), frames[0].Fields[1].At(0))
	assert.Equal(t, "test-service-name", frames[0].Fields[2].At(0))
	assert.Equal(t, "test-root-trace-name", frames[0].Fields[3].At(0))
	assert.Equal(t, 5.0, *(frames[0].Fields[4].At(0).(*float64)))
	assert.NotEmpty(t, frames[0].Fields[5].At(0))
}

func TestTransformSpanSearchResponse(t *testing.T) {
	pCtx := backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "u", Name: "n"}}
	resp := &tempopb.SearchResponse{Traces: []*tempopb.TraceSearchMetadata{{
		TraceID:           "test-trace-id",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: 1000,
		SpanSets: []*tempopb.SpanSet{{
			Attributes: []*v1.KeyValue{{Key: "service.name", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "test-service-name"}}}},
			Spans: []*tempopb.Span{
				{
					SpanID:            "test-span-id",
					Name:              "test-span-name",
					StartTimeUnixNano: 2000,
					DurationNanos:     3000,
					Attributes:        []*v1.KeyValue{{Key: "http.method", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "GET"}}}},
				},
			},
		}},
	}}}

	frames, err := transformSpanSearchResponse(pCtx, resp)
	require.NoError(t, err)
	require.Len(t, frames, 1)

	assert.Equal(t, 1, frames[0].Rows())
	assert.Equal(t, "test-trace-id", frames[0].Fields[0].At(0))
	assert.Equal(t, "test-service-name", frames[0].Fields[1].At(0))
	assert.Equal(t, "test-root-trace-name", frames[0].Fields[2].At(0))
	assert.Equal(t, "test-span-id", frames[0].Fields[3].At(0))
	assert.Equal(t, time.Unix(0, 2000), frames[0].Fields[4].At(0))
	assert.Equal(t, "test-span-name", frames[0].Fields[5].At(0))
	assert.Equal(t, "GET", *(frames[0].Fields[6].At(0).(*string)))
	assert.Equal(t, "test-service-name", *(frames[0].Fields[7].At(0).(*string)))
	assert.Equal(t, 3000.0, frames[0].Fields[8].At(0))
}

func TestTransformRawSearchResponse(t *testing.T) {
	resp := &tempopb.SearchResponse{Traces: []*tempopb.TraceSearchMetadata{{
		TraceID: "test-trace-id-raw",
	}}}

	frames, err := transformRawSearchResponse(resp)
	require.NoError(t, err)
	require.Len(t, frames, 1)

	require.Equal(t, 1, frames[0].Fields[0].Len())
	raw := frames[0].Fields[0].At(0).(string)
	expected := "{\n  \"traces\": [\n    {\n      \"traceID\": \"test-trace-id-raw\"\n    }\n  ]\n}"
	assert.Equal(t, expected, raw)
}

func TestTransformTraceSearchResponse_DurationBelowOneMsIsNil(t *testing.T) {
	pCtx := backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "u", Name: "n"}}
	resp := &tempopb.SearchResponse{Traces: []*tempopb.TraceSearchMetadata{{
		TraceID:           "test-trace-id",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: 2000000,
		DurationMs:        0,
		SpanSet:           &tempopb.SpanSet{Spans: []*tempopb.Span{{SpanID: "span1", Name: "op", StartTimeUnixNano: 1000000, DurationNanos: 1000}}},
	}}}

	frames, err := transformTraceSearchResponse(pCtx, resp)
	require.NoError(t, err)
	require.Len(t, frames, 1)
	require.Equal(t, 1, frames[0].Rows())
	assert.Nil(t, frames[0].Fields[4].At(0))
}

func TestTransformTraceSearchResponse_UsesSpanSetsWhenSpanSetMissing(t *testing.T) {
	pCtx := backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "u", Name: "n"}}
	resp := &tempopb.SearchResponse{Traces: []*tempopb.TraceSearchMetadata{{
		TraceID:           "test-trace-id",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: 1000000,
		DurationMs:        10,
		SpanSets: []*tempopb.SpanSet{
			{Spans: []*tempopb.Span{{SpanID: "span1", Name: "op1", StartTimeUnixNano: 1000000, DurationNanos: 1000}}},
			{Spans: []*tempopb.Span{{SpanID: "span2", Name: "op2", StartTimeUnixNano: 1001000, DurationNanos: 1000}}},
		},
	}}}

	frames, err := transformTraceSearchResponse(pCtx, resp)
	require.NoError(t, err)
	require.Len(t, frames, 1)

	require.Equal(t, 1, frames[0].Rows())
	require.NotNil(t, frames[0].Fields[5].At(0))

	var nestedFrames []json.RawMessage
	require.NoError(t, json.Unmarshal(frames[0].Fields[5].At(0).(json.RawMessage), &nestedFrames))
	assert.Len(t, nestedFrames, 2)
}

func TestTransformTraceSearchResponse_SingularSpanSet(t *testing.T) {
	// A single (singular) trace.SpanSet must still drive the unified-schema path:
	// it produces exactly one nested frame whose dynamic-attribute columns carry
	// the span's values. The plural trace.SpanSets case is covered separately.
	pCtx := backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "u", Name: "n"}}
	resp := &tempopb.SearchResponse{Traces: []*tempopb.TraceSearchMetadata{{
		TraceID:           "test-trace-id",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: 1000000,
		DurationMs:        10,
		SpanSet: &tempopb.SpanSet{
			Spans: []*tempopb.Span{{
				SpanID:            "span1",
				Name:              "op1",
				StartTimeUnixNano: 1000000,
				DurationNanos:     1000,
				Attributes: []*v1.KeyValue{
					{Key: "http.method", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "GET"}}},
				},
			}},
		},
	}}}

	frames, err := transformTraceSearchResponse(pCtx, resp)
	require.NoError(t, err)
	require.Len(t, frames, 1)
	require.Equal(t, 1, frames[0].Rows())

	var nestedFrames []json.RawMessage
	require.NoError(t, json.Unmarshal(frames[0].Fields[5].At(0).(json.RawMessage), &nestedFrames))
	require.Len(t, nestedFrames, 1)

	type schemaField struct {
		Name string `json:"name"`
	}
	type frameEnvelope struct {
		Schema struct {
			Fields []schemaField `json:"fields"`
		} `json:"schema"`
		Data struct {
			Values [][]any `json:"values"`
		} `json:"data"`
	}

	var env frameEnvelope
	require.NoError(t, json.Unmarshal(nestedFrames[0], &env))

	names := make([]string, 0, len(env.Schema.Fields))
	for _, f := range env.Schema.Fields {
		names = append(names, f.Name)
	}
	require.Contains(t, names, "http.method")

	methodIdx := -1
	for i, n := range names {
		if n == "http.method" {
			methodIdx = i
			break
		}
	}
	require.GreaterOrEqual(t, methodIdx, 0)
	require.Len(t, env.Data.Values[methodIdx], 1)
	assert.Equal(t, "GET", env.Data.Values[methodIdx][0])
}

func TestTransformTraceSearchResponseSubFrame_MissingDynamicAttributeUsesNil(t *testing.T) {
	pCtx := backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "u", Name: "n"}}
	trace := &tempopb.TraceSearchMetadata{
		TraceID:           "test-trace-id",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: 1000000,
		DurationMs:        10,
	}
	spanSet := &tempopb.SpanSet{
		Spans: []*tempopb.Span{
			{
				SpanID:            "span1",
				Name:              "op1",
				StartTimeUnixNano: 1000000,
				DurationNanos:     1000,
				Attributes: []*v1.KeyValue{
					{
						Key:   "http.method",
						Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "GET"}},
					},
				},
			},
			{
				SpanID:            "span2",
				Name:              "op2",
				StartTimeUnixNano: 1001000,
				DurationNanos:     1000,
			},
		},
	}

	spanDynamicAttributes, spanAttributeNames, hasNameAttribute := collectSpanSetsSchema([]*tempopb.SpanSet{spanSet})
	frame := transformTraceSearchResponseSubFrame(trace, spanSet, pCtx, spanAttributeNames, spanDynamicAttributes, hasNameAttribute)
	require.NotNil(t, frame)
	require.Equal(t, 2, frame.Rows())
	require.GreaterOrEqual(t, len(frame.Fields), 6)
	assert.Equal(t, "http.method", frame.Fields[4].Name)
	assert.Equal(t, "GET", *(frame.Fields[4].At(0).(*string)))
	assert.True(t, frame.Fields[4].NilAt(1))
}

func TestTransformSpanSearchResponse_MissingDynamicAttributeUsesNil(t *testing.T) {
	pCtx := backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "u", Name: "n"}}
	resp := &tempopb.SearchResponse{Traces: []*tempopb.TraceSearchMetadata{{
		TraceID:           "test-trace-id",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: 1000,
		SpanSets: []*tempopb.SpanSet{{
			Spans: []*tempopb.Span{
				{
					SpanID:            "test-span-id-1",
					Name:              "test-span-name-1",
					StartTimeUnixNano: 2000,
					DurationNanos:     3000,
					Attributes: []*v1.KeyValue{
						{
							Key:   "http.method",
							Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "GET"}},
						},
					},
				},
				{
					SpanID:            "test-span-id-2",
					Name:              "test-span-name-2",
					StartTimeUnixNano: 3000,
					DurationNanos:     4000,
				},
			},
		}},
	}}}

	frames, err := transformSpanSearchResponse(pCtx, resp)
	require.NoError(t, err)
	require.Len(t, frames, 1)
	require.Equal(t, 2, frames[0].Rows())

	assert.Equal(t, "GET", *(frames[0].Fields[6].At(0).(*string)))
	assert.True(t, frames[0].Fields[6].NilAt(1))
}

func TestTransformTraceSearchResponseSubFrame_SameNumericKeyIntAndDouble(t *testing.T) {
	pCtx := backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "u", Name: "n"}}
	trace := &tempopb.TraceSearchMetadata{
		TraceID:           "t1",
		RootServiceName:   "svc",
		RootTraceName:     "op",
		StartTimeUnixNano: 1000000,
		DurationMs:        10,
	}
	// Last attribute seen for "count" during schema scan is int; first span row has double — must not panic on Append.
	spanSet := &tempopb.SpanSet{
		Spans: []*tempopb.Span{
			{
				SpanID:            "s1",
				Name:              "a",
				StartTimeUnixNano: 1000000,
				DurationNanos:     1000,
				Attributes: []*v1.KeyValue{
					{Key: "count", Value: &v1.AnyValue{Value: &v1.AnyValue_DoubleValue{DoubleValue: 1.5}}},
				},
			},
			{
				SpanID:            "s2",
				Name:              "b",
				StartTimeUnixNano: 1001000,
				DurationNanos:     1000,
				Attributes: []*v1.KeyValue{
					{Key: "count", Value: &v1.AnyValue{Value: &v1.AnyValue_IntValue{IntValue: 2}}},
				},
			},
		},
	}

	spanDynamicAttributes, spanAttributeNames, hasNameAttribute := collectSpanSetsSchema([]*tempopb.SpanSet{spanSet})
	frame := transformTraceSearchResponseSubFrame(trace, spanSet, pCtx, spanAttributeNames, spanDynamicAttributes, hasNameAttribute)
	require.NotNil(t, frame)
	require.Equal(t, 2, frame.Rows())
	idx := -1
	for i, f := range frame.Fields {
		if f.Name == "count" {
			idx = i
			break
		}
	}
	require.GreaterOrEqual(t, idx, 0, "expected dynamic field count")
	assert.Equal(t, 1.5, *(frame.Fields[idx].At(0).(*float64)))
	assert.Equal(t, 2.0, *(frame.Fields[idx].At(1).(*float64)))
}

func TestTransformTraceSearchResponse_NestedFramesShareUnifiedSchema(t *testing.T) {
	// Regression for grafana/grafana#121740: when a trace has multiple SpanSets
	// whose dynamic attributes differ, every nested frame stored under the same
	// nestedFrames cell must declare the same fields in the same order. The Table
	// visualization (and other consumers) assumes a single schema per nestedFrames
	// cell and drops cells that don't match.
	pCtx := backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "u", Name: "n"}}
	resp := &tempopb.SearchResponse{Traces: []*tempopb.TraceSearchMetadata{{
		TraceID:           "test-trace-id",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: 1000000,
		DurationMs:        10,
		SpanSets: []*tempopb.SpanSet{
			{
				Spans: []*tempopb.Span{{
					SpanID:            "span1",
					Name:              "op1",
					StartTimeUnixNano: 1000000,
					DurationNanos:     1000,
					Attributes: []*v1.KeyValue{
						{Key: "http.method", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "GET"}}},
					},
				}},
			},
			{
				Spans: []*tempopb.Span{{
					SpanID:            "span2",
					Name:              "op2",
					StartTimeUnixNano: 1001000,
					DurationNanos:     1000,
					Attributes: []*v1.KeyValue{
						{Key: "db.system", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "postgres"}}},
					},
				}},
			},
		},
	}}}

	frames, err := transformTraceSearchResponse(pCtx, resp)
	require.NoError(t, err)
	require.Len(t, frames, 1)
	require.Equal(t, 1, frames[0].Rows())

	var nestedFrames []json.RawMessage
	require.NoError(t, json.Unmarshal(frames[0].Fields[5].At(0).(json.RawMessage), &nestedFrames))
	require.Len(t, nestedFrames, 2)

	// Decode each nested frame just enough to inspect its schema and the first-row
	// value of every column. data.values is column-major: values[col][row].
	type schemaField struct {
		Name string `json:"name"`
	}
	type frameSchema struct {
		Fields []schemaField `json:"fields"`
	}
	type frameData struct {
		Values [][]any `json:"values"`
	}
	type frameEnvelope struct {
		Schema frameSchema `json:"schema"`
		Data   frameData   `json:"data"`
	}

	decode := func(raw json.RawMessage) frameEnvelope {
		var env frameEnvelope
		require.NoError(t, json.Unmarshal(raw, &env))
		return env
	}
	schemaNames := func(env frameEnvelope) []string {
		names := make([]string, 0, len(env.Schema.Fields))
		for _, f := range env.Schema.Fields {
			names = append(names, f.Name)
		}
		return names
	}
	indexOf := func(names []string, want string) int {
		for i, n := range names {
			if n == want {
				return i
			}
		}
		return -1
	}

	firstEnv := decode(nestedFrames[0])
	secondEnv := decode(nestedFrames[1])
	firstNames := schemaNames(firstEnv)
	secondNames := schemaNames(secondEnv)

	assert.Equal(t, firstNames, secondNames, "nested frames under one nestedFrames cell must share a schema")
	assert.Contains(t, firstNames, "http.method")
	assert.Contains(t, firstNames, "db.system")

	// Each subframe owns one of the two attributes; the other column must exist but
	// be nil for the row so consumers don't misalign columns across subframes.
	methodIdx := indexOf(firstNames, "http.method")
	dbIdx := indexOf(firstNames, "db.system")
	require.GreaterOrEqual(t, methodIdx, 0)
	require.GreaterOrEqual(t, dbIdx, 0)

	require.Len(t, firstEnv.Data.Values[methodIdx], 1)
	require.Len(t, firstEnv.Data.Values[dbIdx], 1)
	assert.Equal(t, "GET", firstEnv.Data.Values[methodIdx][0])
	assert.Nil(t, firstEnv.Data.Values[dbIdx][0])

	require.Len(t, secondEnv.Data.Values[methodIdx], 1)
	require.Len(t, secondEnv.Data.Values[dbIdx], 1)
	assert.Nil(t, secondEnv.Data.Values[methodIdx][0])
	assert.Equal(t, "postgres", secondEnv.Data.Values[dbIdx][0])
}

func TestTransformSpanSearchResponse_NoSpanAttributes(t *testing.T) {
	pCtx := backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "u", Name: "n"}}
	resp := &tempopb.SearchResponse{Traces: []*tempopb.TraceSearchMetadata{{
		TraceID:           "test-trace-id",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: 1000,
		SpanSets: []*tempopb.SpanSet{{
			Spans: []*tempopb.Span{
				{
					SpanID:            "test-span-id-1",
					Name:              "test-span-name-1",
					StartTimeUnixNano: 2000,
					DurationNanos:     3000,
				},
				{
					SpanID:            "test-span-id-2",
					Name:              "test-span-name-2",
					StartTimeUnixNano: 3000,
					DurationNanos:     4000,
				},
			},
		}},
	}}}

	frames, err := transformSpanSearchResponse(pCtx, resp)
	require.NoError(t, err)
	require.Len(t, frames, 1)
	require.Equal(t, 2, frames[0].Rows())
	require.Len(t, frames[0].Fields, 7)

	assert.Equal(t, "traceIdHidden", frames[0].Fields[0].Name)
	assert.Equal(t, "traceService", frames[0].Fields[1].Name)
	assert.Equal(t, "traceName", frames[0].Fields[2].Name)
	assert.Equal(t, "spanID", frames[0].Fields[3].Name)
	assert.Equal(t, "time", frames[0].Fields[4].Name)
	assert.Equal(t, "name", frames[0].Fields[5].Name)
	assert.Equal(t, "duration", frames[0].Fields[6].Name)

	assert.Equal(t, "test-span-id-1", frames[0].Fields[3].At(0))
	assert.Equal(t, "test-span-id-2", frames[0].Fields[3].At(1))
	assert.Equal(t, 3000.0, frames[0].Fields[6].At(0))
	assert.Equal(t, 4000.0, frames[0].Fields[6].At(1))
}
