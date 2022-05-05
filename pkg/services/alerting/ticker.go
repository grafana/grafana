package alerting

import (
	"fmt"
	"time"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana/pkg/services/alerting/metrics"
)

// Ticker is a ticker to power the alerting scheduler. it's like a time.Ticker, except:
// * it doesn't drop ticks for slow receivers, rather, it queues up.  so that callers are in control to instrument what's going on.
// * it ticks on interval marks or very shortly after. this provides a predictable load pattern
//   (this shouldn't cause too much load contention issues because the next steps in the pipeline just process at their own pace)
// * the timestamps are used to mark "last datapoint to query for" and as such, are a configurable amount of seconds in the past
type Ticker struct {
	C        chan time.Time
	clock    clock.Clock
	last     time.Time
	interval time.Duration
	metrics  *metrics.Ticker
}

// NewTicker returns a Ticker that ticks on interval marks (or very shortly after) starting at c.Now(), and never drops ticks. interval should not be negative or zero.
func NewTicker(c clock.Clock, interval time.Duration, metric *metrics.Ticker) *Ticker {
	if interval <= 0 {
		panic(fmt.Errorf("non-positive interval [%v] is not allowed", interval))
	}
	t := &Ticker{
		C:        make(chan time.Time),
		clock:    c,
		last:     c.Now(),
		interval: interval,
		metrics:  metric,
	}
	metric.IntervalSeconds.Set(t.interval.Seconds()) // Seconds report fractional part as well, so it matches the format of the timestamp we report below
	go t.run()
	return t
}

func (t *Ticker) run() {
	for {
		next := t.last.Add(t.interval) // calculate the time of the next tick
		t.metrics.NextTickTime.Set(float64(next.UnixNano()) / 1e9)
		diff := t.clock.Now().Sub(next) // calculate the difference between the current time and the next tick
		// if difference is not negative, then it should tick
		if diff >= 0 {
			t.C <- next
			t.last = next
			t.metrics.LastTickTime.Set(float64(next.UnixNano()) / 1e9)
			continue
		}
		// tick is too young. try again when ...
		<-t.clock.After(-diff) // ...it'll definitely be old enough
	}
}
