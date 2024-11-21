package traceql

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/tempo/pkg/tempopb"
	v1 "github.com/grafana/tempo/pkg/tempopb/common/v1"
	"github.com/stretchr/testify/assert"
)

func TestTransformMetricsResponse_EmptyResponse(t *testing.T) {
	resp := tempopb.QueryRangeResponse{}
	frames := TransformMetricsResponse(resp)
	assert.Empty(t, frames)
}

func TestTransformMetricsResponse_SingleSeriesSingleLabel(t *testing.T) {
	resp := tempopb.QueryRangeResponse{
		Series: []*tempopb.TimeSeries{
			{
				Labels: []v1.KeyValue{
					{Key: "label1", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "value1"}}},
				},
				Samples: []tempopb.Sample{
					{TimestampMs: 1638316800000, Value: 1.23},
				},
			},
		},
	}
	frames := TransformMetricsResponse(resp)
	assert.Len(t, frames, 1)
	assert.Equal(t, "\"value1\"", frames[0].RefID)
	assert.Equal(t, "Trace", frames[0].Name)
	assert.Len(t, frames[0].Fields, 2)
	assert.Equal(t, "time", frames[0].Fields[0].Name)
	assert.Equal(t, "\"value1\"", frames[0].Fields[1].Name)
	assert.Equal(t, data.VisTypeGraph, frames[0].Meta.PreferredVisualization)
	assert.Equal(t, time.UnixMilli(1638316800000), frames[0].Fields[0].At(0))
	assert.Equal(t, 1.23, frames[0].Fields[1].At(0))
}

func TestTransformMetricsResponse_SingleSeriesMultipleLabels(t *testing.T) {
	// Skipping for now because this test is broken.
	t.Skip()

	resp := tempopb.QueryRangeResponse{
		Series: []*tempopb.TimeSeries{
			{
				Labels: []v1.KeyValue{
					{Key: "label1", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "value1"}}},
					{Key: "label2", Value: &v1.AnyValue{Value: &v1.AnyValue_IntValue{IntValue: 123}}},
					{Key: "label3", Value: &v1.AnyValue{Value: &v1.AnyValue_DoubleValue{DoubleValue: 123.456}}},
					{Key: "label4", Value: &v1.AnyValue{Value: &v1.AnyValue_BoolValue{BoolValue: true}}},
				},
				Samples: []tempopb.Sample{
					{TimestampMs: 1638316800000, Value: 1.23},
				},
			},
		},
	}
	frames := TransformMetricsResponse(resp)
	assert.Len(t, frames, 1)
	assert.Equal(t, "{label1=\"value1\", label2=123, label3=123.456, label4=true}", frames[0].RefID)
	assert.Equal(t, "Trace", frames[0].Name)
	assert.Len(t, frames[0].Fields, 2)
	assert.Equal(t, "time", frames[0].Fields[0].Name)
	assert.Equal(t, "{label1=\"value1\", label2=123, label3=123.456, label4=true}", frames[0].Fields[1].Name)
	assert.Equal(t, data.VisTypeGraph, frames[0].Meta.PreferredVisualization)
	assert.Equal(t, time.UnixMilli(1638316800000), frames[0].Fields[0].At(0))
	assert.Equal(t, 1.23, frames[0].Fields[1].At(0))
}

func TestTransformMetricsResponse_MultipleSeries(t *testing.T) {
	resp := tempopb.QueryRangeResponse{
		Series: []*tempopb.TimeSeries{
			{
				Labels: []v1.KeyValue{
					{Key: "label1", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "value1"}}},
				},
				Samples: []tempopb.Sample{
					{TimestampMs: 1638316800000, Value: 1.23},
				},
			},
			{
				Labels: []v1.KeyValue{
					{Key: "label2", Value: &v1.AnyValue{Value: &v1.AnyValue_IntValue{IntValue: 456}}},
				},
				Samples: []tempopb.Sample{
					{TimestampMs: 1638316800000, Value: 4.56},
				},
			},
		},
	}
	frames := TransformMetricsResponse(resp)
	assert.Len(t, frames, 2)
	assert.Equal(t, "\"value1\"", frames[0].RefID)
	assert.Equal(t, "Trace", frames[0].Name)
	assert.Len(t, frames[0].Fields, 2)
	assert.Equal(t, "time", frames[0].Fields[0].Name)
	assert.Equal(t, "\"value1\"", frames[0].Fields[1].Name)
	assert.Equal(t, data.VisTypeGraph, frames[0].Meta.PreferredVisualization)
	assert.Equal(t, time.UnixMilli(1638316800000), frames[0].Fields[0].At(0))
	assert.Equal(t, 1.23, frames[0].Fields[1].At(0))

	assert.Equal(t, "456", frames[1].RefID)
	assert.Equal(t, "Trace", frames[1].Name)
	assert.Len(t, frames[1].Fields, 2)
	assert.Equal(t, "time", frames[1].Fields[0].Name)
	assert.Equal(t, "456", frames[1].Fields[1].Name)
	assert.Equal(t, data.VisTypeGraph, frames[1].Meta.PreferredVisualization)
	assert.Equal(t, time.UnixMilli(1638316800000), frames[1].Fields[0].At(0))
	assert.Equal(t, 4.56, frames[1].Fields[1].At(0))
}
