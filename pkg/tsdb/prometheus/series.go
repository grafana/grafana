package prometheus

import (
	"math"

	"github.com/prometheus/common/model"
)

type Series interface {
	Metric() model.Metric
	Len() int
	Next() bool
	Timestamp() int64
	IsSet() bool
	Value() *float64
}

type MatrixSeries struct {
	rowIdx int
	stream *model.SampleStream
}

func (s *MatrixSeries) Metric() model.Metric {
	return s.stream.Metric
}

func (s *MatrixSeries) Len() int {
	return len(s.stream.Values)
}

func (s *MatrixSeries) Next() bool {
	s.rowIdx += 1
	return s.rowIdx < s.Len()
}

func (s *MatrixSeries) Timestamp() int64 {
	return s.stream.Values[s.rowIdx].Timestamp.Unix()
}

func (s *MatrixSeries) IsSet() bool {
	return !math.IsNaN(float64(s.stream.Values[s.rowIdx].Value))
}

func (s *MatrixSeries) Value() *float64 {
	return func(f float64) *float64 { return &f }(float64(s.stream.Values[s.rowIdx].Value))
}

type VectorSeries struct {
	rowIdx int
	sample *model.Sample
}

func (s *VectorSeries) Metric() model.Metric {
	return s.sample.Metric
}

func (s *VectorSeries) Len() int {
	return 1
}

func (s *VectorSeries) Next() bool {
	s.rowIdx += 1
	return s.rowIdx < s.Len()
}

func (s *VectorSeries) Timestamp() int64 {
	return s.sample.Timestamp.Unix()
}

func (s *VectorSeries) IsSet() bool {
	return !math.IsNaN(float64(s.sample.Value))
}

func (s *VectorSeries) Value() *float64 {
	return func(f float64) *float64 { return &f }(float64(s.sample.Value))
}
