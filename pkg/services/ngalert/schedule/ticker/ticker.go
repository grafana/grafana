package ticker

import (
	"fmt"
	"time"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Ticker emits ticks at regular time intervals. it's like a time.Ticker, except:
//   - it doesn't drop ticks for slow receivers, rather, it queues up.  so that callers are in control to instrument what's going on.
//   - it ticks on interval marks or very shortly after. this provides a predictable load pattern
//     (this shouldn't cause too much load contention issues because the next steps in the pipeline just process at their own pace)
//   - the timestamps are used to mark "last datapoint to query for" and as such, are a configurable amount of seconds in the past
type T struct {
	C        chan time.Time
	clock    clock.Clock
	last     time.Time
	interval time.Duration
	metrics  *Metrics
	stopCh   chan struct{}
	logger   log.Logger
}

// NewTicker returns a Ticker that ticks on interval marks (or very shortly after) starting at c.Now(), and never drops ticks. interval should not be negative or zero.
func New(c clock.Clock, interval time.Duration, metric *Metrics, logger log.Logger) *T {
	if interval <= 0 {
		panic(fmt.Errorf("non-positive interval [%v] is not allowed", interval))
	}
	t := &T{
		C:        make(chan time.Time),
		clock:    c,
		last:     getStartTick(c, interval),
		interval: interval,
		metrics:  metric,
		stopCh:   make(chan struct{}),
		logger:   logger,
	}
	metric.IntervalSeconds.Set(t.interval.Seconds()) // Seconds report fractional part as well, so it matches the format of the timestamp we report below
	go t.run()
	return t
}

func getStartTick(clk clock.Clock, interval time.Duration) time.Time {
	nano := clk.Now().UnixNano()
	return time.Unix(0, nano-(nano%interval.Nanoseconds()))
}

func (t *T) run() {
	t.logger.Info("starting", "component", "ticker", "first_tick", t.last.Add(t.interval))
LOOP:
	for {
		next := t.last.Add(t.interval) // calculate the time of the next tick
		t.metrics.NextTickTime.Set(float64(next.UnixNano()) / 1e9)
		diff := t.clock.Now().Sub(next) // calculate the difference between the current time and the next tick
		// if difference is not negative, then it should tick
		if diff >= 0 {
			select {
			case t.C <- next:
			case <-t.stopCh:
				break LOOP
			}
			t.last = next
			t.metrics.LastTickTime.Set(float64(next.UnixNano()) / 1e9)
			continue
		}
		// tick is too young. try again when ...
		select {
		case <-t.clock.After(-diff): // ...it'll definitely be old enough
		case <-t.stopCh:
			break LOOP
		}
	}
	t.logger.Info("stopped", "component", "ticker", "last_tick", t.last)
}

// Stop stops the ticker. It does not close the C channel
func (t *T) Stop() {
	select {
	case t.stopCh <- struct{}{}:
	default:
		// already stopped
	}
}
