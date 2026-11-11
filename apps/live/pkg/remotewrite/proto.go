package remotewrite

import (
	"math"

	"google.golang.org/protobuf/encoding/protowire"
)

// The types below mirror the subset of the Prometheus remote write protobuf
// (prometheus/prompb) used by live. They are encoded by hand to avoid depending
// on the whole Prometheus module for four small messages.

// TimeSeries is a prompb.TimeSeries without exemplars and histograms.
type TimeSeries struct {
	Labels  []Label
	Samples []Sample
}

// Label is a prompb.Label.
type Label struct {
	Name  string
	Value string
}

// Sample is a prompb.Sample.
type Sample struct {
	Value     float64
	Timestamp int64
}

// marshalWriteRequest encodes a prompb.WriteRequest containing the given series.
func marshalWriteRequest(series []TimeSeries) []byte {
	var b []byte
	for _, ts := range series {
		b = protowire.AppendTag(b, 1, protowire.BytesType)
		b = protowire.AppendBytes(b, ts.marshal())
	}
	return b
}

func (ts TimeSeries) marshal() []byte {
	var b []byte
	for _, l := range ts.Labels {
		b = protowire.AppendTag(b, 1, protowire.BytesType)
		b = protowire.AppendBytes(b, l.marshal())
	}
	for _, s := range ts.Samples {
		b = protowire.AppendTag(b, 2, protowire.BytesType)
		b = protowire.AppendBytes(b, s.marshal())
	}
	return b
}

func (l Label) marshal() []byte {
	var b []byte
	if l.Name != "" {
		b = protowire.AppendTag(b, 1, protowire.BytesType)
		b = protowire.AppendString(b, l.Name)
	}
	if l.Value != "" {
		b = protowire.AppendTag(b, 2, protowire.BytesType)
		b = protowire.AppendString(b, l.Value)
	}
	return b
}

func (s Sample) marshal() []byte {
	var b []byte
	if s.Value != 0 {
		b = protowire.AppendTag(b, 1, protowire.Fixed64Type)
		b = protowire.AppendFixed64(b, math.Float64bits(s.Value))
	}
	if s.Timestamp != 0 {
		b = protowire.AppendTag(b, 2, protowire.VarintType)
		b = protowire.AppendVarint(b, uint64(s.Timestamp))
	}
	return b
}
