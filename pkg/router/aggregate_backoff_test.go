package router

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// These tests assert on Until directly rather than a before/after predicate,
// because Until is exactly what aggregateTarget.run resets its timer to -- so
// pinning the returned duration pins the real poll schedule.

func TestCooldown_SteadyStateWhenHealthy(t *testing.T) {
	now := time.Unix(0, 0)
	c := newCooldown(30*time.Second, 5*time.Second, 5*time.Minute)

	require.LessOrEqual(t, c.Until(now), time.Duration(0), "a fresh cooldown must allow an attempt immediately")

	c.OnSuccess(now)
	require.Equal(t, 30*time.Second, c.Until(now))
	require.Equal(t, 29*time.Second, c.Until(now.Add(time.Second)))
	require.Equal(t, time.Duration(0), c.Until(now.Add(30*time.Second)))
}

func TestCooldown_BacksOffOnFailureAndCapsAtMax(t *testing.T) {
	now := time.Unix(0, 0)
	c := newCooldown(30*time.Second, 5*time.Second, 20*time.Second)

	c.OnFailure(now)
	require.Equal(t, 5*time.Second, c.Until(now), "1st failure waits min, not the steady interval")

	now = now.Add(5 * time.Second)
	c.OnFailure(now)
	require.Equal(t, 10*time.Second, c.Until(now), "2nd consecutive failure doubles")

	now = now.Add(10 * time.Second)
	c.OnFailure(now)
	require.Equal(t, 20*time.Second, c.Until(now), "3rd would double to 40s, capped at max")

	now = now.Add(20 * time.Second)
	c.OnFailure(now)
	require.Equal(t, 20*time.Second, c.Until(now), "stays capped, never exceeds max")
}

func TestCooldown_SuccessResetsToSteadyInterval(t *testing.T) {
	now := time.Unix(0, 0)
	c := newCooldown(30*time.Second, 5*time.Second, 5*time.Minute)

	c.OnFailure(now)
	c.OnFailure(now.Add(5 * time.Second))
	now = now.Add(5 * time.Second)

	c.OnSuccess(now)
	require.Equal(t, 30*time.Second, c.Until(now))
}

// Jitter spreads many pollers of one upstream across the interval. It only
// lengthens the healthy wait, never the failure backoff.
func TestCooldown_JitterLengthensOnlyTheHealthyWait(t *testing.T) {
	now := time.Unix(0, 0)
	for _, tc := range []struct {
		random float64
		want   time.Duration
	}{
		{0, 10 * time.Minute},
		{0.5, 10*time.Minute + 30*time.Second},
		{1, 11 * time.Minute},
	} {
		c := newCooldown(10*time.Minute, 5*time.Second, 5*time.Minute).withJitter(0.1, func() float64 { return tc.random })
		c.OnSuccess(now)
		require.Equal(t, tc.want, c.Until(now), "random=%v", tc.random)
	}

	c := newCooldown(10*time.Minute, 5*time.Second, 5*time.Minute).withJitter(0.1, func() float64 { return 1 })
	c.OnFailure(now)
	require.Equal(t, 5*time.Second, c.Until(now))
}
