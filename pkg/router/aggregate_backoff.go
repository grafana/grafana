package router

import "time"

// cooldown paces a background discovery poll: a fixed interval while healthy,
// capped exponential backoff after a failure. It only throttles the poll;
// serving is protected by the per-group circuit breaker.
type cooldown struct {
	steady, min, max time.Duration
	next             time.Time
	current          time.Duration

	// jitter, when positive, lengthens the healthy wait by up to that
	// fraction of steady, so pollers of one upstream do not line up.
	jitter float64
	random func() float64
}

func newCooldown(steady, min, max time.Duration) *cooldown {
	return &cooldown{steady: steady, min: min, max: max}
}

// withJitter lengthens each healthy wait by up to fraction of the steady
// interval; random returns a value in [0, 1).
func (c *cooldown) withJitter(fraction float64, random func() float64) *cooldown {
	c.jitter, c.random = fraction, random
	return c
}

// Until reports how long until the next poll attempt; zero or negative means
// now. It is the poll loop's only pacing source (see aggregateTarget.run).
func (c *cooldown) Until(now time.Time) time.Duration {
	return c.next.Sub(now)
}

// OnSuccess resets the poller to its steady-state interval.
func (c *cooldown) OnSuccess(now time.Time) {
	c.current = 0
	wait := c.steady
	if c.jitter > 0 && c.random != nil {
		wait += time.Duration(float64(c.steady) * c.jitter * c.random())
	}
	c.next = now.Add(wait)
}

// OnFailure doubles the backoff (starting from min), capped at max, and
// schedules the next allowed attempt accordingly.
func (c *cooldown) OnFailure(now time.Time) {
	switch {
	case c.current == 0:
		c.current = c.min
	case c.current*2 > c.max:
		c.current = c.max
	default:
		c.current *= 2
	}
	c.next = now.Add(c.current)
}
