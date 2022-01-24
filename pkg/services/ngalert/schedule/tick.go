package schedule

import (
	"time"
)

// Ticker is an interface for time.Ticker and similar tickers.
type Ticker interface {
	// C returns the chan on which ticks are received.
	C() <-chan time.Time

	// Reset stops the ticker and resets its interval to the
	// specified duration.
	Reset(time.Duration)

	// Stop stops the ticker.
	Stop()
}

// DefaultTicker is a time.Ticker.
type DefaultTicker struct {
	Ticker *time.Ticker
}

func (t *DefaultTicker) C() <-chan time.Time {
	return t.Ticker.C
}

func (t *DefaultTicker) Reset(d time.Duration) {
	t.Ticker.Reset(d)
}

func (t *DefaultTicker) Stop() {
	t.Ticker.Stop()
}

func NewDefaultTicker(d time.Duration) Ticker {
	return &DefaultTicker{Ticker: time.NewTicker(d)}
}

// TestTicker is a ticker where the next tick is sent on each
// call to Tick.
type TestTicker struct {
	interval time.Duration
	last     time.Time
	ticks    chan time.Time
}

// Tick sends the next tick with the time interval seconds
// after the last tick. Tick will block if no receivers are
// waiting to receive the next tick.
func (t *TestTicker) Tick() time.Time {
	next := t.last.Add(t.interval)
	t.ticks <- next
	t.last = next
	return next
}

func (t *TestTicker) C() <-chan time.Time {
	return t.ticks
}

func (t *TestTicker) Reset(_ time.Duration) {}
func (t *TestTicker) Stop()                 {}

// NewTestTicker returns a new test ticker for the interval.
func NewTestTicker(interval time.Duration) *TestTicker {
	return &TestTicker{
		interval: interval,
		last:     time.Now(),
		ticks:    make(chan time.Time),
	}
}
