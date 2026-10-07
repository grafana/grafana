package state

import (
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"
)

func TestAlwaysReady(t *testing.T) {
	p := AlwaysReady{}

	t.Run("ready by default", func(t *testing.T) {
		require.Equal(t, Ready, p.Ready())
	})

	t.Run("MarkReady is a no-op", func(t *testing.T) {
		p.MarkReady()
		require.Equal(t, Ready, p.Ready())
	})

	t.Run("Reset is a no-op", func(t *testing.T) {
		p.Reset()
		require.Equal(t, Ready, p.Ready())
	})
}

func TestGatedProbe(t *testing.T) {
	clk := clock.NewMock()
	p := newGatedProbe(clk, time.Minute)

	t.Run("starts not ready", func(t *testing.T) {
		require.Equal(t, NotReady, p.Ready())
	})

	t.Run("times out once the grace window elapses", func(t *testing.T) {
		clk.Add(time.Minute)
		require.Equal(t, TimedOut, p.Ready())
	})

	t.Run("MarkReady overrides a timed-out probe", func(t *testing.T) {
		p.MarkReady()
		require.Equal(t, Ready, p.Ready())
	})

	t.Run("Reset returns to not ready and restarts the window", func(t *testing.T) {
		p.Reset()
		require.Equal(t, NotReady, p.Ready())

		clk.Add(time.Minute - time.Nanosecond)
		require.Equal(t, NotReady, p.Ready())

		clk.Add(time.Nanosecond)
		require.Equal(t, TimedOut, p.Ready())
	})
}
