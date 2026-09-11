package router

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCooldown_SteadyStateWhenHealthy(t *testing.T) {
	now := time.Unix(0, 0)
	c := newCooldown(30*time.Second, 5*time.Second, 5*time.Minute)

	require.True(t, c.Ready(now))
	c.OnSuccess(now)
	require.False(t, c.Ready(now.Add(1*time.Second)))
	require.True(t, c.Ready(now.Add(30*time.Second)))
}

func TestCooldown_BacksOffOnFailureAndCapsAtMax(t *testing.T) {
	now := time.Unix(0, 0)
	c := newCooldown(30*time.Second, 5*time.Second, 20*time.Second)

	c.OnFailure(now) // 1st failure: wait min (5s)
	require.False(t, c.Ready(now.Add(4*time.Second)))
	require.True(t, c.Ready(now.Add(5*time.Second)))

	now = now.Add(5 * time.Second)
	c.OnFailure(now) // 2nd consecutive failure: doubles to 10s
	require.False(t, c.Ready(now.Add(9*time.Second)))
	require.True(t, c.Ready(now.Add(10*time.Second)))

	now = now.Add(10 * time.Second)
	c.OnFailure(now) // 3rd: would double to 20s, at cap
	require.False(t, c.Ready(now.Add(19*time.Second)))
	require.True(t, c.Ready(now.Add(20*time.Second)))

	now = now.Add(20 * time.Second)
	c.OnFailure(now) // 4th: stays capped at 20s, never exceeds max
	require.True(t, c.Ready(now.Add(20*time.Second)))
	require.False(t, c.Ready(now.Add(19*time.Second)))
}

func TestCooldown_SuccessResetsToSteadyInterval(t *testing.T) {
	now := time.Unix(0, 0)
	c := newCooldown(30*time.Second, 5*time.Second, 5*time.Minute)

	c.OnFailure(now)
	c.OnFailure(now.Add(5 * time.Second))
	now = now.Add(5 * time.Second)

	c.OnSuccess(now)
	require.False(t, c.Ready(now.Add(29*time.Second)))
	require.True(t, c.Ready(now.Add(30*time.Second)))
}
