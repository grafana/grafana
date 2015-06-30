// it's commonly used for non-timer cases where we want these summaries, that's
// what this is for.
package statsdmetric

type Meter struct {
	key string
}

func NewMeter(key string, val int64) Meter {
	m := Meter{key}
	m.Value(val)
	return m
}

func (m Meter) Value(val int64) {
	Stat.Timing(m.key, val)
}
