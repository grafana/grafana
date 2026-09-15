package testutils

import "time"

type FakeClock struct {
	Current time.Time
}

func NewFakeClock() *FakeClock {
	return &FakeClock{Current: time.Now()}
}

func (c *FakeClock) Now() time.Time {
	return c.Current
}

func (c *FakeClock) AdvanceBy(duration time.Duration) {
	c.Current = c.Current.Add(duration)
}
