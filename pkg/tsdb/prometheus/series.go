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

func (r *MatrixSeries) Timestamp() int64 {
	return r.stream.Values[r.rowIdx].Timestamp.Unix()
}

func (r *MatrixSeries) IsSet() bool {
	return !math.IsNaN(float64(r.stream.Values[r.rowIdx].Value))
}

func (r *MatrixSeries) Value() *float64 {
	return func(f float64) *float64 { return &f }(float64(r.stream.Values[r.rowIdx].Value))
}
