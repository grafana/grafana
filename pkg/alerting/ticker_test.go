package alerting

import (
	"testing"
	"time"

	"github.com/benbjohnson/clock"
)

func inspectTick(tick Tick, last time.Time, offset time.Duration, t *testing.T) {
	if tick.dataUntil.Unix() != last.Add(time.Duration(1)*time.Second).Unix() {
		t.Errorf("last processed was %s, expected the new value (%s) to have a dataUntil of 1 second more", last, tick)
	}
	if !tick.dataUntil.Add(offset).Equal(tick.executeAt) {
		t.Errorf("tick %s should have dataUntil %s prior to executeAt", tick, offset)
	}
}

// returns the new lastProcessed seen
func assertAdvanceUntil(ticker *Ticker, last, desiredLast time.Time, offset, wait time.Duration, t *testing.T) time.Time {
	for {
		select {
		case v := <-ticker.C:
			inspectTick(v, last, offset, t)
			last = v.dataUntil
		case <-time.NewTimer(wait).C:
			if last.Before(desiredLast) {
				t.Errorf("waited %s for ticker to advance to %s, but only went up to %s", wait, desiredLast, last)
			}
			if last.After(desiredLast) {
				t.Errorf("timer advanced too far. went to %s, should only have gone up to %s", last, desiredLast)
			}
			return desiredLast
		}
	}
}

func assertNoAdvance(ticker *Ticker, desiredLast time.Time, wait time.Duration, t *testing.T) {
	for {
		select {
		case v := <-ticker.C:
			t.Errorf("timer advanced, it shouldn't have. It went to %s, it should have stayed at %s", v.dataUntil, desiredLast)
		case <-time.NewTimer(wait).C:
			return
		}
	}
}

func TestTickerRetro1Hour(t *testing.T) {
	offset := time.Duration(10) * time.Second
	lastProcessed := time.Unix(0, 0)
	mock := clock.NewMock()
	mock.Add(time.Duration(1) * time.Hour)
	desiredLast := mock.Now().Add(-offset)
	ticker := NewTicker(lastProcessed, offset, mock)

	lastProcessed = assertAdvanceUntil(ticker, lastProcessed, desiredLast, offset, time.Duration(10)*time.Millisecond, t)
	assertNoAdvance(ticker, desiredLast, time.Duration(500)*time.Millisecond, t)

}

func TestAdvanceWithUpdateOffset(t *testing.T) {
	offset := time.Duration(10) * time.Second
	lastProcessed := time.Unix(0, 0)
	mock := clock.NewMock()
	mock.Add(time.Duration(1) * time.Hour)
	desiredLast := mock.Now().Add(-offset)
	ticker := NewTicker(lastProcessed, offset, mock)

	lastProcessed = assertAdvanceUntil(ticker, lastProcessed, desiredLast, offset, time.Duration(10)*time.Millisecond, t)
	assertNoAdvance(ticker, desiredLast, time.Duration(500)*time.Millisecond, t)

	// lowering offset should see a few more ticks
	offset = time.Duration(5) * time.Second
	ticker.updateOffset(offset)
	desiredLast = mock.Now().Add(-offset)
	lastProcessed = assertAdvanceUntil(ticker, lastProcessed, desiredLast, offset, time.Duration(9)*time.Millisecond, t)
	assertNoAdvance(ticker, desiredLast, time.Duration(500)*time.Millisecond, t)

	// advancing clock should see even more ticks
	mock.Add(time.Duration(1) * time.Hour)
	desiredLast = mock.Now().Add(-offset)
	lastProcessed = assertAdvanceUntil(ticker, lastProcessed, desiredLast, offset, time.Duration(8)*time.Millisecond, t)
	assertNoAdvance(ticker, desiredLast, time.Duration(500)*time.Millisecond, t)

}

func getCase(lastSeconds, offsetSeconds int) (time.Time, time.Duration) {
	lastProcessed := time.Unix(int64(lastSeconds), 0)
	offset := time.Duration(offsetSeconds) * time.Second
	return lastProcessed, offset
}

func TestTickerNoAdvance(t *testing.T) {

	// it's 00:01:00 now. what are some cases where we don't want the ticker to advance?
	mock := clock.NewMock()
	mock.Add(time.Duration(60) * time.Second)

	type Case struct {
		lastProcessed int
		offset        int
	}

	// note that some cases add up to now, others go into the future
	cases := []Case{
		Case{50, 10},
		Case{50, 30},
		Case{59, 1},
		Case{59, 10},
		Case{59, 30},
		Case{60, 1},
		Case{60, 10},
		Case{60, 30},
		Case{90, 1},
		Case{90, 10},
		Case{90, 30},
	}
	for _, c := range cases {
		lastProcessed, offset := getCase(c.lastProcessed, c.offset)
		desiredLast := lastProcessed
		ticker := NewTicker(lastProcessed, offset, mock)
		assertNoAdvance(ticker, desiredLast, time.Duration(500)*time.Millisecond, t)
	}
}
