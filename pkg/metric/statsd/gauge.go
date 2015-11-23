package statsd

import (
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/metric"
)

type Gauge struct {
	key string
	val int64
	sync.Mutex
	backend Backend
}

func (b Backend) NewGauge(key string, val int64) metric.Gauge {
	g := Gauge{
		key:     key,
		backend: b,
	}
	go func() {
		for {
			g.Lock()
			g.backend.client.Gauge(g.key, g.val)
			g.Unlock()
			time.Sleep(time.Duration(1) * time.Second)
		}
	}()
	return &g
}

func (g *Gauge) Value(val int64) {
	g.Lock()
	defer g.Unlock()
	g.val = val
	g.backend.client.Gauge(g.key, val)
}

func (g *Gauge) Inc(val int64) {
	g.Lock()
	defer g.Unlock()
	g.val += val
	g.backend.client.Gauge(g.key, g.val)
}

func (g *Gauge) Dec(val int64) {
	g.Lock()
	defer g.Unlock()
	g.val -= val
	g.backend.client.Gauge(g.key, g.val)
}
