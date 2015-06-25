package alerting

import (
	"fmt"
	"sync"
	"time"
)

// ticker is a ticker to power the alerting scheduler. it's like a time.Ticker, except:
// * it doesn't drop ticks for slow receivers, rather, it queues up.  so that callers are in control to instrument what's going on.
// * it automatically ticks every second, which is the right thing in our current design
// * it ticks on second marks or very shortly after. this provides a predictable load pattern
//   (this shouldn't cause too much load contention issues because the next steps in the pipeline just process at their own pace)
// * the timestamps are used to mark "last datapoint to query for" and as such, are a configurable amount of seconds in the past
// * because we want to allow:
//   - a clean "resume where we left off" and "don't yield ticks we already did"
//   - adjusting offset over time to compensate for storage backing up or getting fast and providing lower latency
//   you specify a lastProcessed timestamp as well as an offset at creation, or runtime
type Ticker struct {
	offset time.Duration
	lock   sync.Mutex

	lastTick Tick

	C chan Tick
}

type Tick struct {
	dataUntil time.Time // time corresponding to timestamp of last point(s) to query for
	executeAt time.Time // earliest time at which it can be acted on
}

func (t Tick) String() string {
	return fmt.Sprintf("Tick for data @%s (executeAt %s)", t.dataUntil, t.executeAt)
}

func (t *Ticker) NewTickDataUntil(dataUntil time.Time) Tick {
	t.lock.Lock()
	defer t.lock.Unlock()
	tick := Tick{
		dataUntil,
		dataUntil.Add(t.offset),
	}
	return tick
}

// NewTicker returns a ticker that ticks on second marks or very shortly after, and never drops ticks
func NewTicker(lastProcessed time.Time, initialOffset time.Duration) *Ticker {
	t := &Ticker{
		offset: initialOffset,
		C:      make(chan Tick),
	}
	t.lastTick = t.NewTickDataUntil(lastProcessed)
	go t.run()
	return t
}

func (t *Ticker) updateOffset(offset time.Duration) {
	t.lock.Lock()
	t.offset = offset
	t.lock.Unlock()
}

func (t *Ticker) run() {
	for {
		nextTick := t.NewTickDataUntil(t.lastTick.dataUntil.Add(time.Duration(1) * time.Second))
		now := time.Now()

		if nextTick.executeAt.Unix() > now.Unix() {
			// we're caught up. don't process times that are in the future.
			// rather sleep until nextTick.
			time.Sleep(nextTick.executeAt.Sub(now))
		}

		t.C <- nextTick
		t.lastTick = nextTick
	}
}
