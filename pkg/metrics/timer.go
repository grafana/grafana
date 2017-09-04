// includes code from
// https://raw.githubusercontent.com/rcrowley/go-metrics/master/sample.go
// Copyright 2012 Richard Crowley. All rights reserved.

package metrics

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Timers capture the duration and rate of events.
type Timer interface {
	Metric

	Count() int64
	Max() int64
	Mean() float64
	Min() int64
	Percentile(float64) float64
	Percentiles([]float64) []float64
	Rate1() float64
	Rate5() float64
	Rate15() float64
	RateMean() float64
	StdDev() float64
	Sum() int64
	Time(func())
	Update(time.Duration)
	UpdateSince(time.Time)
	Variance() float64
}

// NewTimer constructs a new StandardTimer using an exponentially-decaying
// sample with the same reservoir size and alpha as UNIX load averages.
func NewTimer(meta *MetricMeta) Timer {
	promSummary := prometheus.NewSummary(prometheus.SummaryOpts{
		Name:        promifyName(meta.Name()),
		Help:        meta.Name(),
		ConstLabels: prometheus.Labels(meta.GetTagsCopy()),
	})

	prometheus.MustRegister(promSummary)

	return &StandardTimer{
		MetricMeta: meta,
		histogram:  NewHistogram(meta, NewExpDecaySample(1028, 0.015)),
		meter:      NewMeter(meta),
		Summary:    promSummary,
	}
}

func RegTimer(name string, tagStrings ...string) Timer {
	tr := NewTimer(NewMetricMeta(name, tagStrings))
	MetricStats.Register(tr)
	return tr
}

// NilTimer is a no-op Timer.
type NilTimer struct {
	*MetricMeta
	h Histogram
	m Meter
}

// Count is a no-op.
func (NilTimer) Count() int64 { return 0 }

// Max is a no-op.
func (NilTimer) Max() int64 { return 0 }

// Mean is a no-op.
func (NilTimer) Mean() float64 { return 0.0 }

// Min is a no-op.
func (NilTimer) Min() int64 { return 0 }

// Percentile is a no-op.
func (NilTimer) Percentile(p float64) float64 { return 0.0 }

// Percentiles is a no-op.
func (NilTimer) Percentiles(ps []float64) []float64 {
	return make([]float64, len(ps))
}

// Rate1 is a no-op.
func (NilTimer) Rate1() float64 { return 0.0 }

// Rate5 is a no-op.
func (NilTimer) Rate5() float64 { return 0.0 }

// Rate15 is a no-op.
func (NilTimer) Rate15() float64 { return 0.0 }

// RateMean is a no-op.
func (NilTimer) RateMean() float64 { return 0.0 }

// Snapshot is a no-op.
func (n NilTimer) Snapshot() Metric { return n }

// StdDev is a no-op.
func (NilTimer) StdDev() float64 { return 0.0 }

// Sum is a no-op.
func (NilTimer) Sum() int64 { return 0 }

// Time is a no-op.
func (NilTimer) Time(func()) {}

// Update is a no-op.
func (NilTimer) Update(time.Duration) {}

// UpdateSince is a no-op.
func (NilTimer) UpdateSince(time.Time) {}

// Variance is a no-op.
func (NilTimer) Variance() float64 { return 0.0 }

// StandardTimer is the standard implementation of a Timer and uses a Histogram
// and Meter.
type StandardTimer struct {
	*MetricMeta
	histogram Histogram
	meter     Meter
	mutex     sync.Mutex
	prometheus.Summary
}

// Count returns the number of events recorded.
func (t *StandardTimer) Count() int64 {
	return t.histogram.Count()
}

// Max returns the maximum value in the sample.
func (t *StandardTimer) Max() int64 {
	return t.histogram.Max()
}

// Mean returns the mean of the values in the sample.
func (t *StandardTimer) Mean() float64 {
	return t.histogram.Mean()
}

// Min returns the minimum value in the sample.
func (t *StandardTimer) Min() int64 {
	return t.histogram.Min()
}

// Percentile returns an arbitrary percentile of the values in the sample.
func (t *StandardTimer) Percentile(p float64) float64 {
	return t.histogram.Percentile(p)
}

// Percentiles returns a slice of arbitrary percentiles of the values in the
// sample.
func (t *StandardTimer) Percentiles(ps []float64) []float64 {
	return t.histogram.Percentiles(ps)
}

// Rate1 returns the one-minute moving average rate of events per second.
func (t *StandardTimer) Rate1() float64 {
	return t.meter.Rate1()
}

// Rate5 returns the five-minute moving average rate of events per second.
func (t *StandardTimer) Rate5() float64 {
	return t.meter.Rate5()
}

// Rate15 returns the fifteen-minute moving average rate of events per second.
func (t *StandardTimer) Rate15() float64 {
	return t.meter.Rate15()
}

// RateMean returns the meter's mean rate of events per second.
func (t *StandardTimer) RateMean() float64 {
	return t.meter.RateMean()
}

// Snapshot returns a read-only copy of the timer.
func (t *StandardTimer) Snapshot() Metric {
	t.mutex.Lock()
	defer t.mutex.Unlock()
	return &TimerSnapshot{
		MetricMeta: t.MetricMeta,
		histogram:  t.histogram.Snapshot().(*HistogramSnapshot),
		meter:      t.meter.Snapshot().(*MeterSnapshot),
	}
}

// StdDev returns the standard deviation of the values in the sample.
func (t *StandardTimer) StdDev() float64 {
	return t.histogram.StdDev()
}

// Sum returns the sum in the sample.
func (t *StandardTimer) Sum() int64 {
	return t.histogram.Sum()
}

// Record the duration of the execution of the given function.
func (t *StandardTimer) Time(f func()) {
	ts := time.Now()
	f()
	t.Update(time.Since(ts))
}

// Record the duration of an event.
func (t *StandardTimer) Update(d time.Duration) {
	t.mutex.Lock()
	defer t.mutex.Unlock()
	t.histogram.Update(int64(d))
	t.meter.Mark(1)

	t.Summary.Observe(float64(d))
}

// Record the duration of an event that started at a time and ends now.
func (t *StandardTimer) UpdateSince(ts time.Time) {
	t.mutex.Lock()
	defer t.mutex.Unlock()
	sinceMs := time.Since(ts) / time.Millisecond
	t.histogram.Update(int64(sinceMs))
	t.meter.Mark(1)

	t.Summary.Observe(float64(sinceMs))
}

// Variance returns the variance of the values in the sample.
func (t *StandardTimer) Variance() float64 {
	return t.histogram.Variance()
}

// TimerSnapshot is a read-only copy of another Timer.
type TimerSnapshot struct {
	*MetricMeta
	histogram *HistogramSnapshot
	meter     *MeterSnapshot
}

// Count returns the number of events recorded at the time the snapshot was
// taken.
func (t *TimerSnapshot) Count() int64 { return t.histogram.Count() }

// Max returns the maximum value at the time the snapshot was taken.
func (t *TimerSnapshot) Max() int64 { return t.histogram.Max() }

// Mean returns the mean value at the time the snapshot was taken.
func (t *TimerSnapshot) Mean() float64 { return t.histogram.Mean() }

// Min returns the minimum value at the time the snapshot was taken.
func (t *TimerSnapshot) Min() int64 { return t.histogram.Min() }

// Percentile returns an arbitrary percentile of sampled values at the time the
// snapshot was taken.
func (t *TimerSnapshot) Percentile(p float64) float64 {
	return t.histogram.Percentile(p)
}

// Percentiles returns a slice of arbitrary percentiles of sampled values at
// the time the snapshot was taken.
func (t *TimerSnapshot) Percentiles(ps []float64) []float64 {
	return t.histogram.Percentiles(ps)
}

// Rate1 returns the one-minute moving average rate of events per second at the
// time the snapshot was taken.
func (t *TimerSnapshot) Rate1() float64 { return t.meter.Rate1() }

// Rate5 returns the five-minute moving average rate of events per second at
// the time the snapshot was taken.
func (t *TimerSnapshot) Rate5() float64 { return t.meter.Rate5() }

// Rate15 returns the fifteen-minute moving average rate of events per second
// at the time the snapshot was taken.
func (t *TimerSnapshot) Rate15() float64 { return t.meter.Rate15() }

// RateMean returns the meter's mean rate of events per second at the time the
// snapshot was taken.
func (t *TimerSnapshot) RateMean() float64 { return t.meter.RateMean() }

// Snapshot returns the snapshot.
func (t *TimerSnapshot) Snapshot() Metric { return t }

// StdDev returns the standard deviation of the values at the time the snapshot
// was taken.
func (t *TimerSnapshot) StdDev() float64 { return t.histogram.StdDev() }

// Sum returns the sum at the time the snapshot was taken.
func (t *TimerSnapshot) Sum() int64 { return t.histogram.Sum() }

// Time panics.
func (*TimerSnapshot) Time(func()) {
	panic("Time called on a TimerSnapshot")
}

// Update panics.
func (*TimerSnapshot) Update(time.Duration) {
	panic("Update called on a TimerSnapshot")
}

// UpdateSince panics.
func (*TimerSnapshot) UpdateSince(time.Time) {
	panic("UpdateSince called on a TimerSnapshot")
}

// Variance returns the variance of the values at the time the snapshot was
// taken.
func (t *TimerSnapshot) Variance() float64 { return t.histogram.Variance() }
