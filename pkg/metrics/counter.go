package metrics

import (
	"strings"
	"sync/atomic"

	"github.com/prometheus/client_golang/prometheus"
)

// Counters hold an int64 value that can be incremented and decremented.
type Counter interface {
	Metric

	Clear()
	Count() int64
	Inc(int64)
}

func promifyName(name string) string {
	return strings.Replace(name, ".", "_", -1)
}

// NewCounter constructs a new StandardCounter.
func NewCounter(meta *MetricMeta) Counter {
	promCounter := prometheus.NewCounter(prometheus.CounterOpts{
		Name:        promifyName(meta.Name()) + "_total",
		Help:        meta.Name(),
		ConstLabels: prometheus.Labels(meta.GetTagsCopy()),
	})

	prometheus.MustRegister(promCounter)

	return &StandardCounter{
		MetricMeta: meta,
		count:      0,
		Counter:    promCounter,
	}
}

func RegCounter(name string, tagStrings ...string) Counter {
	cr := NewCounter(NewMetricMeta(name, tagStrings))
	//MetricStats.Register(cr)
	return cr
}

// StandardCounter is the standard implementation of a Counter and uses the
// sync/atomic package to manage a single int64 value.
type StandardCounter struct {
	count int64 //Due to a bug in golang the 64bit variable need to come first to be 64bit aligned. https://golang.org/pkg/sync/atomic/#pkg-note-BUG
	*MetricMeta
	prometheus.Counter
}

// Clear sets the counter to zero.
func (c *StandardCounter) Clear() {
	atomic.StoreInt64(&c.count, 0)
}

// Count returns the current count.
func (c *StandardCounter) Count() int64 {
	return atomic.LoadInt64(&c.count)
}

// Dec decrements the counter by the given amount.
func (c *StandardCounter) Dec(i int64) {
	atomic.AddInt64(&c.count, -i)
}

// Inc increments the counter by the given amount.
func (c *StandardCounter) Inc(i int64) {
	atomic.AddInt64(&c.count, i)
	c.Counter.Add(float64(i))
}

func (c *StandardCounter) Snapshot() Metric {
	return &StandardCounter{
		MetricMeta: c.MetricMeta,
		count:      c.count,
	}
}
