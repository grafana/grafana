package statsdmetric

type Count struct {
	key string
}

func NewCount(key string) Count {
	c := Count{key}
	c.Inc(0)
	return c
}

func (c Count) Inc(val int64) {
	Stat.IncrementValue(c.key, val)
}
