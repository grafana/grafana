package statsdmetric

type Gauge struct {
	key string
}

func NewGauge(key string, val int64) Gauge {
	g := Gauge{key}
	g.Value(val)
	return g
}

func (g Gauge) Value(val int64) {
	Stat.Gauge(g.key, val)
}
