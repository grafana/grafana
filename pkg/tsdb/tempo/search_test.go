package tempo

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateSearchRequest(t *testing.T) {
	datasource := &DatasourceInfo{URL: "http://localhost:3200"}
	var qstring string = "{service.name=\"svc\"}"
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
	resp := &SearchResponse{Traces: []*TraceSearchMetadata{{
		TraceID:           "test-trace-id-x",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: "2000000",
		DurationMs:        5,
		SpanSet:           &SpanSet{Spans: []*Span{{SpanID: "span1", Name: "op", StartTimeUnixNano: "1000000", DurationNanos: "1000"}}},
	}, {
		TraceID:           "test-trace-id-y",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: "1000000",
		DurationMs:        10,
		SpanSet:           &SpanSet{Spans: []*Span{{SpanID: "span1", Name: "op", StartTimeUnixNano: "1000000", DurationNanos: "1000"}}},
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
	resp := &SearchResponse{Traces: []*TraceSearchMetadata{{
		TraceID:           "test-trace-id",
		RootServiceName:   "test-service-name",
		RootTraceName:     "test-root-trace-name",
		StartTimeUnixNano: "1000",
		SpanSets: []*SpanSet{{
			Attributes: []Attribute{{Key: "service.name", Value: AttributeValue{StringValue: "test-service-name"}}},
			Spans: []*Span{{
				SpanID:            "test-span-id",
				Name:              "test-span-name",
				StartTimeUnixNano: "2000",
				DurationNanos:     "3000",
				Attributes:        []Attribute{{Key: "http.method", Value: AttributeValue{StringValue: "GET"}}},
			}},
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
	assert.Equal(t, "GET", frames[0].Fields[6].At(0))
	assert.Equal(t, "test-service-name", frames[0].Fields[7].At(0))
	assert.Equal(t, 3000.0, frames[0].Fields[8].At(0))
}

func TestTransformRawSearchResponse(t *testing.T) {
	resp := &SearchResponse{Traces: []*TraceSearchMetadata{{
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
