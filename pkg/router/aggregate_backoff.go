package router

import "time"

// cooldown paces one aggregate target's discovery polls: a fixed interval
// while healthy, exponential backoff (capped) after a failure, reset to the
// fixed interval on the next success. This is deliberately not a
// gobreaker.CircuitBreaker -- a breaker gates request *serving* (open/
// half-open/closed against caller traffic); this only throttles a
// background poll's own outbound call rate, so there is no caller-facing
// state to protect and a plain backoff is the right-sized tool. See
// AGENTS.md's amended discovery section for why this exists alongside,
// not instead of, the per-group gobreaker breaker.
type cooldown struct {
	steady, min, max time.Duration
	next             time.Time
	current          time.Duration
}

func newCooldown(steady, min, max time.Duration) *cooldown {
	return &cooldown{steady: steady, min: min, max: max}
}

// Ready reports whether a poll attempt may run now.
func (c *cooldown) Ready(now time.Time) bool {
	return !now.Before(c.next)
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
