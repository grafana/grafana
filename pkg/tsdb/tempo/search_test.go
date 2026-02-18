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

	frame := transformTraceSearchResponseSubFrame(trace, spanSet, pCtx)
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
