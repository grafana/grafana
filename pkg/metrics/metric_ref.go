package metrics

type comboCounterRef struct {
	*MetricMeta
	usageCounter  Counter
	metricCounter Counter
}

type comboTimerRef struct {
	*MetricMeta
	usageTimer  Timer
	metricTimer Timer
}

func RegComboCounter(name string, tagStrings ...string) Counter {
	meta := NewMetricMeta(name, tagStrings)
	cr := &comboCounterRef{
		MetricMeta:    meta,
		usageCounter:  NewCounter(meta),
		metricCounter: NewCounter(meta),
	}

	UsageStats.Register(cr.usageCounter)
	MetricStats.Register(cr.metricCounter)

	return cr
}

func RegComboTimer(name string, tagStrings ...string) Timer {
	meta := NewMetricMeta(name, tagStrings)
	tr := &comboTimerRef{
		MetricMeta:  meta,
		usageTimer:  NewTimer(meta),
		metricTimer: NewTimer(meta),
	}

	UsageStats.Register(tr.usageTimer)
	MetricStats.Register(tr.metricTimer)
	return tr
}

func RegTimer(name string, tagStrings ...string) Timer {
	tr := NewTimer(NewMetricMeta(name, tagStrings))
	MetricStats.Register(tr)
	return tr
}

func (t comboTimerRef) Clear() {
	t.metricTimer.Clear()
	t.usageTimer.Clear()
}

func (t comboTimerRef) Avg() int64 {
	panic("Avg called on combotimer ref")
}

func (t comboTimerRef) Min() int64 {
	panic("Avg called on combotimer ref")
}

func (t comboTimerRef) Max() int64 {
	panic("Avg called on combotimer ref")
}

func (t comboTimerRef) Count() int64 {
	panic("Avg called on combotimer ref")
}

func (t comboTimerRef) Snapshot() Metric {
	panic("Snapshot called on combotimer ref")
}

func (t comboTimerRef) AddTiming(timing int64) {
	t.metricTimer.AddTiming(timing)
	t.usageTimer.AddTiming(timing)
}

func (c comboCounterRef) Clear() {
	c.usageCounter.Clear()
	c.metricCounter.Clear()
}

func (c comboCounterRef) Count() int64 {
	panic("Count called on a combocounter ref")
}

// Dec panics.
func (c comboCounterRef) Dec(i int64) {
	c.usageCounter.Dec(i)
	c.metricCounter.Dec(i)
}

// Inc panics.
func (c comboCounterRef) Inc(i int64) {
	c.usageCounter.Inc(i)
	c.metricCounter.Inc(i)
}

func (c comboCounterRef) Snapshot() Metric {
	return c.metricCounter.Snapshot()
}
