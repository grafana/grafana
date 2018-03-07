package metrics

// type comboCounterRef struct {
// 	*MetricMeta
// 	usageCounter  Counter
// 	metricCounter Counter
// }
//
// func RegComboCounter(name string, tagStrings ...string) Counter {
// 	meta := NewMetricMeta(name, tagStrings)
// 	cr := &comboCounterRef{
// 		MetricMeta:    meta,
// 		usageCounter:  NewCounter(meta),
// 		metricCounter: NewCounter(meta),
// 	}
//
// 	UsageStats.Register(cr.usageCounter)
// 	MetricStats.Register(cr.metricCounter)
//
// 	return cr
// }
//
// func (c comboCounterRef) Clear() {
// 	c.usageCounter.Clear()
// 	c.metricCounter.Clear()
// }
//
// func (c comboCounterRef) Count() int64 {
// 	panic("Count called on a combocounter ref")
// }
//
// // Dec panics.
// func (c comboCounterRef) Dec(i int64) {
// 	c.usageCounter.Dec(i)
// 	c.metricCounter.Dec(i)
// }
//
// // Inc panics.
// func (c comboCounterRef) Inc(i int64) {
// 	c.usageCounter.Inc(i)
// 	c.metricCounter.Inc(i)
// }
//
// func (c comboCounterRef) Snapshot() Metric {
// 	return c.metricCounter.Snapshot()
// }
