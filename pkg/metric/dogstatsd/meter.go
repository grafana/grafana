// it's commonly used for non-timer cases where we want these summaries, that's
// what this is for.
package dogstatsd

import "github.com/grafana/grafana/pkg/metric"

type Meter struct {
	key     string
	backend Backend
}

func (b Backend) NewMeter(key string, val int64) metric.Meter {
	m := Meter{key, b}
	m.Value(val)
	return m
}

func (m Meter) Value(val int64) {
	m.backend.client.Histogram(m.key, float64(val), []string{}, 1)
}
