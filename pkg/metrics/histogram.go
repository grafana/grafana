// includes code from
// https://raw.githubusercontent.com/rcrowley/go-metrics/master/sample.go
// Copyright 2012 Richard Crowley. All rights reserved.

package metrics

// Histograms calculate distribution statistics from a series of int64 values.
type Histogram interface {
	Metric

	Clear()
	Count() int64
	Max() int64
	Mean() float64
	Min() int64
	Percentile(float64) float64
	Percentiles([]float64) []float64
	StdDev() float64
	Sum() int64
	Update(int64)
	Variance() float64
}

func NewHistogram(meta *MetricMeta, s Sample) Histogram {
	return &StandardHistogram{
		MetricMeta: meta,
		sample:     s,
	}
}

// HistogramSnapshot is a read-only copy of another Histogram.
type HistogramSnapshot struct {
	*MetricMeta
	sample *SampleSnapshot
}

// Clear panics.
func (*HistogramSnapshot) Clear() {
	panic("Clear called on a HistogramSnapshot")
}

// Count returns the number of samples recorded at the time the snapshot was
// taken.
func (h *HistogramSnapshot) Count() int64 { return h.sample.Count() }

// Max returns the maximum value in the sample at the time the snapshot was
// taken.
func (h *HistogramSnapshot) Max() int64 { return h.sample.Max() }

// Mean returns the mean of the values in the sample at the time the snapshot
// was taken.
func (h *HistogramSnapshot) Mean() float64 { return h.sample.Mean() }

// Min returns the minimum value in the sample at the time the snapshot was
// taken.
func (h *HistogramSnapshot) Min() int64 { return h.sample.Min() }

// Percentile returns an arbitrary percentile of values in the sample at the
// time the snapshot was taken.
func (h *HistogramSnapshot) Percentile(p float64) float64 {
	return h.sample.Percentile(p)
}

// Percentiles returns a slice of arbitrary percentiles of values in the sample
// at the time the snapshot was taken.
func (h *HistogramSnapshot) Percentiles(ps []float64) []float64 {
	return h.sample.Percentiles(ps)
}

// Sample returns the Sample underlying the histogram.
func (h *HistogramSnapshot) Sample() Sample { return h.sample }

// Snapshot returns the snapshot.
func (h *HistogramSnapshot) Snapshot() Metric { return h }

// StdDev returns the standard deviation of the values in the sample at the
// time the snapshot was taken.
func (h *HistogramSnapshot) StdDev() float64 { return h.sample.StdDev() }

// Sum returns the sum in the sample at the time the snapshot was taken.
func (h *HistogramSnapshot) Sum() int64 { return h.sample.Sum() }

// Update panics.
func (*HistogramSnapshot) Update(int64) {
	panic("Update called on a HistogramSnapshot")
}

// Variance returns the variance of inputs at the time the snapshot was taken.
func (h *HistogramSnapshot) Variance() float64 { return h.sample.Variance() }

// NilHistogram is a no-op Histogram.
type NilHistogram struct {
	*MetricMeta
}

// Clear is a no-op.
func (NilHistogram) Clear() {}

// Count is a no-op.
func (NilHistogram) Count() int64 { return 0 }

// Max is a no-op.
func (NilHistogram) Max() int64 { return 0 }

// Mean is a no-op.
func (NilHistogram) Mean() float64 { return 0.0 }

// Min is a no-op.
func (NilHistogram) Min() int64 { return 0 }

// Percentile is a no-op.
func (NilHistogram) Percentile(p float64) float64 { return 0.0 }

// Percentiles is a no-op.
func (NilHistogram) Percentiles(ps []float64) []float64 {
	return make([]float64, len(ps))
}

// Sample is a no-op.
func (NilHistogram) Sample() Sample { return NilSample{} }

// Snapshot is a no-op.
func (n NilHistogram) Snapshot() Metric { return n }

// StdDev is a no-op.
func (NilHistogram) StdDev() float64 { return 0.0 }

// Sum is a no-op.
func (NilHistogram) Sum() int64 { return 0 }

// Update is a no-op.
func (NilHistogram) Update(v int64) {}

// Variance is a no-op.
func (NilHistogram) Variance() float64 { return 0.0 }

// StandardHistogram is the standard implementation of a Histogram and uses a
// Sample to bound its memory use.
type StandardHistogram struct {
	*MetricMeta
	sample Sample
}

// Clear clears the histogram and its sample.
func (h *StandardHistogram) Clear() { h.sample.Clear() }

// Count returns the number of samples recorded since the histogram was last
// cleared.
func (h *StandardHistogram) Count() int64 { return h.sample.Count() }

// Max returns the maximum value in the sample.
func (h *StandardHistogram) Max() int64 { return h.sample.Max() }

// Mean returns the mean of the values in the sample.
func (h *StandardHistogram) Mean() float64 { return h.sample.Mean() }

// Min returns the minimum value in the sample.
func (h *StandardHistogram) Min() int64 { return h.sample.Min() }

// Percentile returns an arbitrary percentile of the values in the sample.
func (h *StandardHistogram) Percentile(p float64) float64 {
	return h.sample.Percentile(p)
}

// Percentiles returns a slice of arbitrary percentiles of the values in the
// sample.
func (h *StandardHistogram) Percentiles(ps []float64) []float64 {
	return h.sample.Percentiles(ps)
}

// Sample returns the Sample underlying the histogram.
func (h *StandardHistogram) Sample() Sample { return h.sample }

// Snapshot returns a read-only copy of the histogram.
func (h *StandardHistogram) Snapshot() Metric {
	return &HistogramSnapshot{sample: h.sample.Snapshot().(*SampleSnapshot)}
}

// StdDev returns the standard deviation of the values in the sample.
func (h *StandardHistogram) StdDev() float64 { return h.sample.StdDev() }

// Sum returns the sum in the sample.
func (h *StandardHistogram) Sum() int64 { return h.sample.Sum() }

// Update samples a new value.
func (h *StandardHistogram) Update(v int64) { h.sample.Update(v) }

// Variance returns the variance of the values in the sample.
func (h *StandardHistogram) Variance() float64 { return h.sample.Variance() }
