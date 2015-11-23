package dogstatsd

import "github.com/grafana/grafana/pkg/metric"

type Count struct {
	key     string
	backend Backend
}

func (b Backend) NewCount(key string) metric.Count {
	c := Count{key, b}
	c.Inc(0)
	return c
}

func (c Count) Inc(val int64) {
	c.backend.client.Count(c.key, val, []string{}, 1)
}
