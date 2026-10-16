package router

import "time"

// cooldown paces a background discovery poll: a fixed interval while healthy,
// capped exponential backoff after a failure. It only throttles the poll;
// serving is protected by the per-group circuit breaker.
type cooldown struct {
	steady, min, max time.Duration
	next             time.Time
	current          time.Duration
}

func newCooldown(steady, min, max time.Duration) *cooldown {
	return &cooldown{steady: steady, min: min, max: max}
}

// Until reports how long until the next poll attempt; zero or negative means
// now. It is the poll loop's only pacing source (see aggregateTarget.run).
func (c *cooldown) Until(now time.Time) time.Duration {
	return c.next.Sub(now)
}

// OnSuccess resets the poller to its steady-state interval.
func (c *cooldown) OnSuccess(now time.Time) {
	c.current = 0
	c.next = now.Add(c.steady)
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
