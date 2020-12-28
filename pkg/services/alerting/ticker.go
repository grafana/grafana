package alerting

import (
	"time"

	"github.com/benbjohnson/clock"
)

// Ticker is a ticker to power the alerting scheduler. it's like a time.Ticker, except:
// * it doesn't drop ticks for slow receivers, rather, it queues up.  so that callers are in control to instrument what's going on.
// * it automatically ticks every second, which is the right thing in our current design
// * it ticks on intervalSec marks or very shortly after. this provides a predictable load pattern
//   (this shouldn't cause too much load contention issues because the next steps in the pipeline just process at their own pace)
// * the timestamps are used to mark "last datapoint to query for" and as such, are a configurable amount of seconds in the past
// * because we want to allow:
//   - a clean "resume where we left off" and "don't yield ticks we already did"
//   - adjusting offset over time to compensate for storage backing up or getting fast and providing lower latency
//   you specify a lastProcessed timestamp as well as an offset at creation, or runtime
type Ticker struct {
	C           chan time.Time
	clock       clock.Clock
	last        time.Time
	offset      time.Duration
	newOffset   chan time.Duration
	intervalSec int64
	paused      bool
}

// NewTicker returns a ticker that ticks on intervalSec marks or very shortly after, and never drops ticks
func NewTicker(last time.Time, initialOffset time.Duration, c clock.Clock, intervalSec int64) *Ticker {
	t := &Ticker{
		C:           make(chan time.Time),
		clock:       c,
		last:        last,
		offset:      initialOffset,
		newOffset:   make(chan time.Duration),
		intervalSec: intervalSec,
	}
	go t.run()
	return t
}

func (t *Ticker) run() {
	for {
		next := t.last.Add(time.Duration(t.intervalSec) * time.Second)
		diff := t.clock.Now().Add(-t.offset).Sub(next)
		if diff >= 0 {
			if !t.paused {
				t.C <- next
			}
			t.last = next
			continue
		}
		// tick is too young. try again when ...
		select {
		case <-t.clock.After(-diff): // ...it'll definitely be old enough
		case offset := <-t.newOffset: // ...it might be old enough
			t.offset = offset
		}
	}
}

// ResetOffset resets the offset.
func (t *Ticker) ResetOffset(duration time.Duration) {
	t.newOffset <- duration
}

// Pause unpauses the ticker and no ticks will be sent.
func (t *Ticker) Pause() {
	t.paused = true
}

// Unpause unpauses the ticker and ticks will be sent.
func (t *Ticker) Unpause() {
	t.paused = false
}
