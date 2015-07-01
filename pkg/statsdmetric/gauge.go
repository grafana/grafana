package statsdmetric

import (
	"sync"
	"time"
)

type Gauge struct {
	key string
	val int64
	sync.Mutex
	autoFlush bool
}

func NewGauge(key string, val int64) *Gauge {
	g := Gauge{
		key: key,
	}
	g.Value(val)
	return &g
}

func (g *Gauge) AutoFlush() *Gauge {
	if !g.autoFlush {
		go func() {
			for {
				g.Lock()
				Stat.Gauge(g.key, g.val)
				g.Unlock()
				time.Sleep(time.Duration(1) * time.Second)
			}
		}()
	}
	g.autoFlush = true
	return g
}

func (g *Gauge) Value(val int64) {
	g.Lock()
	defer g.Unlock()
	g.val = val
	Stat.Gauge(g.key, val)
}

func (g *Gauge) Inc(val int64) {
	g.Lock()
	defer g.Unlock()
	g.val += val
	Stat.Gauge(g.key, g.val)
}

func (g *Gauge) Dec(val int64) {
	g.Lock()
	defer g.Unlock()
	g.val -= val
	Stat.Gauge(g.key, g.val)
}
