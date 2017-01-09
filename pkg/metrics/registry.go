package metrics

import "sync"

type Registry interface {
	GetSnapshots() []Metric
	Register(metric Metric)
}

// The standard implementation of a Registry is a mutex-protected map
// of names to metrics.
type StandardRegistry struct {
	metrics []Metric
	mutex   sync.Mutex
}

// Create a new registry.
func NewRegistry() Registry {
	return &StandardRegistry{
		metrics: make([]Metric, 0),
	}
}

func (r *StandardRegistry) Register(metric Metric) {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	r.metrics = append(r.metrics, metric)
}

// Call the given function for each registered metric.
func (r *StandardRegistry) GetSnapshots() []Metric {
	metrics := make([]Metric, len(r.metrics))
	for i, metric := range r.metrics {
		metrics[i] = metric.Snapshot()
	}
	return metrics
}
