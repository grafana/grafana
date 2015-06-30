package statsdmetric

import "time"

// note that due the preseeding in init, you shouldn't rely on the count and count_ps summaries
// rather, consider maintaining a separate counter
// see https://github.com/raintank/grafana/issues/133

type Timer struct {
	key string
}

func NewTimer(key string, val time.Duration) Timer {
	t := Timer{key}
	t.Value(val)
	return t
}

func (t Timer) Value(val time.Duration) {
	Stat.TimeDuration(t.key, val)
}
