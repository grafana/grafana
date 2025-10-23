// Code generated from semantic convention specification. DO NOT EDIT.

package grafanaconv

import (
	"context"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/metric/noop"
)

var (
	addOptPool = &sync.Pool{New: func() any { return &[]metric.AddOption{} }}
	recOptPool = &sync.Pool{New: func() any { return &[]metric.RecordOption{} }}
)

// PluginLoadDuration is an instrument used to record metric values conforming to the "grafana.plugin.load.duration" semantic conventions. It represents the time taken to load plugins from a source.
type PluginLoadDuration struct {
	metric.Float64Histogram
}

var newPluginLoadDurationOpts = []metric.Float64HistogramOption{
	metric.WithDescription("Time taken to load plugins from a source"),
	metric.WithUnit("ms"),
}

// NewPluginLoadDuration returns a new PluginLoadDuration instrument.
func NewPluginLoadDuration(
	m metric.Meter,
	opt ...metric.Float64HistogramOption,
) (PluginLoadDuration, error) {
	// Check if the meter is nil.
	if m == nil {
		return PluginLoadDuration{noop.Float64Histogram{}}, nil
	}

	if len(opt) == 0 {
		opt = newPluginLoadDurationOpts
	} else {
		opt = append(opt, newPluginLoadDurationOpts...)
	}

	i, err := m.Float64Histogram(
		"grafana.plugin.load.duration",
		opt...,
	)
	if err != nil {
		return PluginLoadDuration{noop.Float64Histogram{}}, err
	}
	return PluginLoadDuration{i}, nil
}

// Inst returns the underlying metric instrument.
func (m PluginLoadDuration) Inst() metric.Float64Histogram {
	return m.Float64Histogram
}

// Name returns the semantic convention name of the instrument.
func (PluginLoadDuration) Name() string {
	return "grafana.plugin.load.duration"
}

// Unit returns the semantic convention unit of the instrument
func (PluginLoadDuration) Unit() string {
	return "ms"
}

// Description returns the semantic convention description of the instrument
func (PluginLoadDuration) Description() string {
	return "Time taken to load plugins from a source"
}

// Record records val to the current distribution for attrs.
func (m PluginLoadDuration) Record(ctx context.Context, val float64, attrs ...attribute.KeyValue) {
	if len(attrs) == 0 {
		m.Float64Histogram.Record(ctx, val)
		return
	}

	o := recOptPool.Get().(*[]metric.RecordOption)
	defer func() {
		*o = (*o)[:0]
		recOptPool.Put(o)
	}()

	*o = append(*o, metric.WithAttributes(attrs...))
	m.Float64Histogram.Record(ctx, val, *o...)
}

// RecordSet records val to the current distribution for set.
func (m PluginLoadDuration) RecordSet(ctx context.Context, val float64, set attribute.Set) {
	if set.Len() == 0 {
		m.Float64Histogram.Record(ctx, val)
	}

	o := recOptPool.Get().(*[]metric.RecordOption)
	defer func() {
		*o = (*o)[:0]
		recOptPool.Put(o)
	}()

	*o = append(*o, metric.WithAttributeSet(set))
	m.Float64Histogram.Record(ctx, val, *o...)
}
