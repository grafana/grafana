package metrics

type comboCounterRef struct {
	usageCounter  Counter
	metricCounter Counter
}

func NewComboCounterRef(name string) Counter {
	cr := &comboCounterRef{}
	cr.usageCounter = UsageStats.GetOrRegister(name, NewCounter).(Counter)
	cr.metricCounter = MetricStats.GetOrRegister(name, NewCounter).(Counter)
	return cr
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

// Snapshot returns the snapshot.
func (c comboCounterRef) Snapshot() Counter {
	panic("snapshot called on a combocounter ref")
}
