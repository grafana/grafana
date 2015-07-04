package metric

import "time"

type Backend interface {
	NewCount(key string) Count
	NewGauge(key string, val int64) Gauge
	NewMeter(key string, val int64) Meter
	NewTimer(key string, val time.Duration) Timer
}

// Count is a type that counts how many hits it's seen in each given interval
// and computes the rate per second
// it's not a long-running counter.
// values are explicit
type Count interface {
	Inc(val int64)
}

// gauge makes sure its value is explicit (i.e. for statsd, keep sending)
type Gauge interface {
	Dec(val int64)
	Inc(val int64)
	Value(val int64)
}

// like a timer, but not just for timings
type Meter interface {
	Value(val int64)
}

// computes stasticical summaries
type Timer interface {
	Value(val time.Duration)
}
