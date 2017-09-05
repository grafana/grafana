// includes code from
// https://raw.githubusercontent.com/rcrowley/go-metrics/master/sample.go
// Copyright 2012 Richard Crowley. All rights reserved.

package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Timers capture the duration and rate of events.
type Timer interface {
	Metric

	Update(time.Duration)
	UpdateSince(time.Time)
}

func RegTimer(name string, tagStrings ...string) Timer {
	meta := NewMetricMeta(name, tagStrings)
	promSummary := prometheus.NewSummary(prometheus.SummaryOpts{
		Name:        promifyName(meta.Name()),
		Help:        meta.Name(),
		ConstLabels: prometheus.Labels(meta.GetTagsCopy()),
	})

	prometheus.MustRegister(promSummary)

	return &StandardTimer{
		MetricMeta: meta,
		Summary:    promSummary,
	}
}

// StandardTimer is the standard implementation of a Timer and uses a Histogram
// and Meter.
type StandardTimer struct {
	*MetricMeta

	prometheus.Summary
}

// Record the duration of an event.
func (t *StandardTimer) Update(d time.Duration) {
	t.Summary.Observe(float64(d))
}

// Record the duration of an event that started at a time and ends now.
func (t *StandardTimer) UpdateSince(ts time.Time) {
	t.Summary.Observe(float64(time.Since(ts) / time.Millisecond))
}
