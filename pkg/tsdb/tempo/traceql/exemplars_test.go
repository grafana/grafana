package traceql

import (
	"testing"
	"time"

	"github.com/grafana/tempo/pkg/tempopb"
	v1 "github.com/grafana/tempo/pkg/tempopb/common/v1"
	"github.com/stretchr/testify/assert"
)

func TestTransformExemplarToFrame_EmptyExemplars(t *testing.T) {
	frame := transformExemplarToFrame("test", &tempopb.TimeSeries{
		Labels:     nil,
		Samples:    nil,
		PromLabels: "",
		Exemplars:  make([]tempopb.Exemplar, 0),
	})
	assert.NotNil(t, frame)
	assert.Equal(t, "test", frame.RefID)
	assert.Equal(t, "exemplar", frame.Name)
	assert.Len(t, frame.Fields, 3)
	assert.Empty(t, frame.Fields[0].Len())
	assert.Empty(t, frame.Fields[1].Len())
	assert.Empty(t, frame.Fields[2].Len())
}

func TestTransformExemplarToFrame_SingleExemplar(t *testing.T) {
	exemplars := []tempopb.Exemplar{
		{
			TimestampMs: 1638316800000,
			Value:       1.23,
			Labels: []v1.KeyValue{
				{Key: "trace:id", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "trace-123"}}},
			},
		},
	}
	frame := transformExemplarToFrame("test", &tempopb.TimeSeries{
		Labels:     nil,
		Samples:    nil,
		PromLabels: "",
		Exemplars:  exemplars,
	})
	assert.NotNil(t, frame)
	assert.Equal(t, "test", frame.RefID)
	assert.Equal(t, "exemplar", frame.Name)
	assert.Len(t, frame.Fields, 3)
	assert.Equal(t, time.UnixMilli(1638316800000), frame.Fields[0].At(0))
	assert.Equal(t, 1.23, frame.Fields[1].At(0))
	assert.Equal(t, "trace-123", frame.Fields[2].At(0))
}

func TestTransformExemplarToFrame_SingleExemplarHistogram(t *testing.T) {
	exemplars := []tempopb.Exemplar{
		{
			TimestampMs: 1638316800000,
			Value:       1.23,
			Labels: []v1.KeyValue{
				{Key: "trace:id", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "trace-123"}}},
				{Key: "__bucket", Value: &v1.AnyValue{Value: &v1.AnyValue_DoubleValue{DoubleValue: 1.23}}},
			},
		},
	}
	frame := transformExemplarToFrame("test", &tempopb.TimeSeries{
		Labels: []v1.KeyValue{
			{Key: "__bucket", Value: &v1.AnyValue{Value: &v1.AnyValue_DoubleValue{DoubleValue: 1.23}}},
		},
		Samples:    nil,
		PromLabels: "",
		Exemplars:  exemplars,
	})
	assert.NotNil(t, frame)
	assert.Equal(t, "test", frame.RefID)
	assert.Equal(t, "exemplar", frame.Name)
	assert.Len(t, frame.Fields, 4)
	assert.Equal(t, time.UnixMilli(1638316800000), frame.Fields[0].At(0))
	assert.Equal(t, 1.23, frame.Fields[1].At(0))
	assert.Equal(t, "trace-123", frame.Fields[2].At(0))
}

func TestTransformExemplarToFrame_MultipleExemplars(t *testing.T) {
	exemplars := []tempopb.Exemplar{
		{
			TimestampMs: 1638316800000,
			Value:       1.23,
			Labels: []v1.KeyValue{
				{Key: "trace:id", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "trace-123"}}},
			},
		},
		{
			TimestampMs: 1638316801000,
			Value:       4.56,
			Labels: []v1.KeyValue{
				{Key: "trace:id", Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: "trace-456"}}},
			},
		},
	}
	frame := transformExemplarToFrame("test", &tempopb.TimeSeries{
		Labels:     nil,
		Samples:    nil,
		PromLabels: "",
		Exemplars:  exemplars,
	})
	assert.NotNil(t, frame)
	assert.Equal(t, "test", frame.RefID)
	assert.Equal(t, "exemplar", frame.Name)
	assert.Len(t, frame.Fields, 3)
	assert.Equal(t, time.UnixMilli(1638316800000), frame.Fields[0].At(0))
	assert.Equal(t, 1.23, frame.Fields[1].At(0))
	assert.Equal(t, "trace-123", frame.Fields[2].At(0))
	assert.Equal(t, time.UnixMilli(1638316801000), frame.Fields[0].At(1))
	assert.Equal(t, 4.56, frame.Fields[1].At(1))
	assert.Equal(t, "trace-456", frame.Fields[2].At(1))
}

func TestTransformExemplarToFrame_ExemplarWithoutTraceId(t *testing.T) {
	exemplars := []tempopb.Exemplar{
		{
			TimestampMs: 1638316800000,
			Value:       1.23,
			Labels:      []v1.KeyValue{},
		},
	}
	frame := transformExemplarToFrame("test", &tempopb.TimeSeries{
		Labels:     nil,
		Samples:    nil,
		PromLabels: "",
		Exemplars:  exemplars,
	})
	assert.NotNil(t, frame)
	assert.Equal(t, "test", frame.RefID)
	assert.Equal(t, "exemplar", frame.Name)
	assert.Len(t, frame.Fields, 3)
	assert.Equal(t, time.UnixMilli(1638316800000), frame.Fields[0].At(0))
	assert.Equal(t, 1.23, frame.Fields[1].At(0))
	assert.Equal(t, "", frame.Fields[2].At(0))
}
