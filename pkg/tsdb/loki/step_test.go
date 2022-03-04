package loki

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLokiStep(t *testing.T) {
	t.Run("base case", func(t *testing.T) {
		require.Equal(t, time.Second*14, calculateStep(time.Second*7, time.Second, 2))
	})

	t.Run("step should be at least 1 millisecond", func(t *testing.T) {
		require.Equal(t, time.Millisecond*1, calculateStep(time.Microsecond*500, time.Second, 1))
	})

	t.Run("safeInterval should happen", func(t *testing.T) {
		// safeInterval
		require.Equal(t, time.Second*3, calculateStep(time.Second*2, time.Second*33000, 1))
	})

	t.Run("step should math.Ceil in milliseconds", func(t *testing.T) {
		require.Equal(t, time.Millisecond*2, calculateStep(time.Microsecond*1234, time.Second*1, 1))
	})

	t.Run("step should math.Ceil in milliseconds, even if safeInterval happens", func(t *testing.T) {
		require.Equal(t, time.Millisecond*3001, calculateStep(time.Second*2, time.Second*33001, 1))
	})

	t.Run("resolution should happen", func(t *testing.T) {
		require.Equal(t, time.Second*5, calculateStep(time.Second*1, time.Second*100, 5))
	})

	t.Run("safeInterval check should happen after resolution is used", func(t *testing.T) {
		require.Equal(t, time.Second*4, calculateStep(time.Second*2, time.Second*33000, 2))
	})

	t.Run("survive interval=0", func(t *testing.T) {
		// interval=0. this should never happen, but we make sure we return something sane
		// (in this case safeInterval will take care of the problem)
		require.Equal(t, time.Second*2, calculateStep(time.Second*0, time.Second*22000, 1))
	})

	t.Run("survive resolution=0", func(t *testing.T) {
		// resolution=0. this should never happen, but we make sure we return something sane
		// (in this case safeInterval will take care of the problem)
		require.Equal(t, time.Second*2, calculateStep(time.Second*1, time.Second*22000, 0))
	})

	t.Run("survive interval=0 and resolution=0", func(t *testing.T) {
		// resolution=0 and interval=0. this should never happen, but we make sure we return something sane
		// (in this case safeInterval will take care of the problem)
		require.Equal(t, time.Second*2, calculateStep(time.Second*0, time.Second*22000, 0))
	})
}
