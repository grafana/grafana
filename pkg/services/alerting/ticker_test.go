package alerting

//import (
//	"testing"
//	"time"
//
//	"github.com/benbjohnson/clock"
//)
//
//func inspectTick(tick time.Time, last time.Time, offset time.Duration, t *testing.T) {
//	if !tick.Equal(last.Add(time.Duration(1) * time.Second)) {
//		t.Fatalf("expected a tick 1 second more than prev, %s. got: %s", last, tick)
//	}
//}
//
//// returns the new last tick seen
//func assertAdvanceUntil(ticker *Ticker, last, desiredLast time.Time, offset, wait time.Duration, t *testing.T) time.Time {
//	for {
//		select {
//		case tick := <-ticker.C:
//			inspectTick(tick, last, offset, t)
//			last = tick
//		case <-time.NewTimer(wait).C:
//			if last.Before(desiredLast) {
//				t.Fatalf("waited %s for ticker to advance to %s, but only went up to %s", wait, desiredLast, last)
//			}
//			if last.After(desiredLast) {
//				t.Fatalf("timer advanced too far. should only have gone up to %s, but it went up to %s", desiredLast, last)
//			}
//			return last
//		}
//	}
//}
//
//func assertNoAdvance(ticker *Ticker, desiredLast time.Time, wait time.Duration, t *testing.T) {
//	for {
//		select {
//		case tick := <-ticker.C:
//			t.Fatalf("timer should have stayed at %s, instead it advanced to %s", desiredLast, tick)
//		case <-time.NewTimer(wait).C:
//			return
//		}
//	}
//}
//
//func TestTickerRetro1Hour(t *testing.T) {
//	offset := time.Duration(10) * time.Second
//	last := time.Unix(0, 0)
//	mock := clock.NewMock()
//	mock.Add(time.Duration(1) * time.Hour)
//	desiredLast := mock.Now().Add(-offset)
//	ticker := NewTicker(last, offset, mock)
//
//	last = assertAdvanceUntil(ticker, last, desiredLast, offset, time.Duration(10)*time.Millisecond, t)
//	assertNoAdvance(ticker, last, time.Duration(500)*time.Millisecond, t)
//
//}
//
//func TestAdvanceWithUpdateOffset(t *testing.T) {
//	offset := time.Duration(10) * time.Second
//	last := time.Unix(0, 0)
//	mock := clock.NewMock()
//	mock.Add(time.Duration(1) * time.Hour)
//	desiredLast := mock.Now().Add(-offset)
//	ticker := NewTicker(last, offset, mock)
//
//	last = assertAdvanceUntil(ticker, last, desiredLast, offset, time.Duration(10)*time.Millisecond, t)
//	assertNoAdvance(ticker, last, time.Duration(500)*time.Millisecond, t)
//
//	// lowering offset should see a few more ticks
//	offset = time.Duration(5) * time.Second
//	ticker.updateOffset(offset)
//	desiredLast = mock.Now().Add(-offset)
//	last = assertAdvanceUntil(ticker, last, desiredLast, offset, time.Duration(9)*time.Millisecond, t)
//	assertNoAdvance(ticker, last, time.Duration(500)*time.Millisecond, t)
//
//	// advancing clock should see even more ticks
//	mock.Add(time.Duration(1) * time.Hour)
//	desiredLast = mock.Now().Add(-offset)
//	last = assertAdvanceUntil(ticker, last, desiredLast, offset, time.Duration(8)*time.Millisecond, t)
//	assertNoAdvance(ticker, last, time.Duration(500)*time.Millisecond, t)
//
//}
//
//func getCase(lastSeconds, offsetSeconds int) (time.Time, time.Duration) {
//	last := time.Unix(int64(lastSeconds), 0)
//	offset := time.Duration(offsetSeconds) * time.Second
//	return last, offset
//}
//
//func TestTickerNoAdvance(t *testing.T) {
//
//	// it's 00:01:00 now. what are some cases where we don't want the ticker to advance?
//	mock := clock.NewMock()
//	mock.Add(time.Duration(60) * time.Second)
//
//	type Case struct {
//		last   int
//		offset int
//	}
//
//	// note that some cases add up to now, others go into the future
//	cases := []Case{
//		{50, 10},
//		{50, 30},
//		{59, 1},
//		{59, 10},
//		{59, 30},
//		{60, 1},
//		{60, 10},
//		{60, 30},
//		{90, 1},
//		{90, 10},
//		{90, 30},
//	}
//	for _, c := range cases {
//		last, offset := getCase(c.last, c.offset)
//		ticker := NewTicker(last, offset, mock)
//		assertNoAdvance(ticker, last, time.Duration(500)*time.Millisecond, t)
//	}
//}
