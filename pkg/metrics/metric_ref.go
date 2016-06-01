package metrics

type comboCounterRef struct {
	usageCounter  Counter
	metricCounter Counter
}

type comboTimerRef struct {
	usageTimer  Timer
	metricTimer Timer
}

func NewComboCounterRef(name string) Counter {
	cr := &comboCounterRef{}
	cr.usageCounter = UsageStats.GetOrRegister(name, NewCounter).(Counter)
	cr.metricCounter = MetricStats.GetOrRegister(name, NewCounter).(Counter)
	return cr
}

func NewComboTimerRef(name string) Timer {
	tr := &comboTimerRef{}
	tr.usageTimer = UsageStats.GetOrRegister(name, NewTimer).(Timer)
	tr.metricTimer = MetricStats.GetOrRegister(name, NewTimer).(Timer)
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

func (t comboTimerRef) Total() int64 {
	panic("Avg called on combotimer ref")
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

// Snapshot returns the snapshot.
func (c comboCounterRef) Snapshot() Counter {
	panic("snapshot called on a combocounter ref")
}
