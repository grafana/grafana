package loki

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLokiStep(t *testing.T) {
	t.Run("with query step", func(t *testing.T) {
		t.Run("valid step in go duration format", func(t *testing.T) {
			queryStep := "1m"
			step, err := calculateStep(time.Second*7, time.Second, 2, &queryStep)
			require.NoError(t, err)
			require.Equal(t, time.Minute*2, step)
		})

		t.Run("valid step as number", func(t *testing.T) {
			queryStep := "30"
			step, err := calculateStep(time.Second*7, time.Second, 2, &queryStep)
			require.NoError(t, err)
			require.Equal(t, time.Minute*1, step)
		})

		// calculateStep parses a duration with support for unit that Grafana uses (e.g 1d)
		t.Run("step with 1d", func(t *testing.T) {
			queryStep := "1d"
			step, err := calculateStep(time.Second*7, time.Second, 2, &queryStep)
			require.NoError(t, err)
			require.Equal(t, time.Hour*48, step)
		})

		// calculateStep parses a duration with support for unit that Grafana uses (e.g 1w)
		t.Run("step with 1w", func(t *testing.T) {
			queryStep := "1w"
			step, err := calculateStep(time.Second*7, time.Second, 2, &queryStep)
			require.NoError(t, err)
			require.Equal(t, time.Hour*336, step)
		})

		// Returns error
		t.Run("invalid step", func(t *testing.T) {
			queryStep := "invalid"
			step, err := calculateStep(time.Second*7, time.Second, 2, &queryStep)
			require.Error(t, err)
			require.Equal(t, time.Duration(0), step)
		})
	})
	t.Run("with no query step", func(t *testing.T) {
		t.Run("base case", func(t *testing.T) {
			step, err := calculateStep(time.Second*7, time.Second, 2, nil)
			require.NoError(t, err)
			require.Equal(t, time.Second*14, step)
		})

		t.Run("step should be at least 1 millisecond", func(t *testing.T) {
			step, err := calculateStep(time.Microsecond*500, time.Second, 1, nil)
			require.NoError(t, err)
			require.Equal(t, time.Millisecond*1, step)
		})

		t.Run("safeInterval should happen", func(t *testing.T) {
			// safeInterval
			step, err := calculateStep(time.Second*2, time.Second*33000, 1, nil)
			require.NoError(t, err)
			require.Equal(t, time.Second*3, step)
		})

		t.Run("step should math.Ceil in milliseconds", func(t *testing.T) {
			step, err := calculateStep(time.Microsecond*1234, time.Second*1, 1, nil)
			require.NoError(t, err)
			require.Equal(t, time.Millisecond*2, step)
		})

		t.Run("step should math.Ceil in milliseconds, even if safeInterval happens", func(t *testing.T) {
			step, err := calculateStep(time.Second*2, time.Second*33001, 1, nil)
			require.NoError(t, err)
			require.Equal(t, time.Millisecond*3001, step)
		})

		t.Run("resolution should happen", func(t *testing.T) {
			step, err := calculateStep(time.Second*1, time.Second*100, 5, nil)
			require.NoError(t, err)
			require.Equal(t, time.Second*5, step)
		})

		t.Run("safeInterval check should happen after resolution is used", func(t *testing.T) {
			step, err := calculateStep(time.Second*2, time.Second*33000, 2, nil)
			require.NoError(t, err)
			require.Equal(t, time.Second*4, step)
		})

		t.Run("survive interval=0", func(t *testing.T) {
			// interval=0. this should never happen, but we make sure we return something sane
			// (in this case safeInterval will take care of the problem)
			step, err := calculateStep(time.Second*0, time.Second*22000, 1, nil)
			require.NoError(t, err)
			require.Equal(t, time.Second*2, step)
		})

		t.Run("survive resolution=0", func(t *testing.T) {
			// resolution=0. this should never happen, but we make sure we return something sane
			// (in this case safeInterval will take care of the problem)
			step, err := calculateStep(time.Second*1, time.Second*22000, 0, nil)
			require.NoError(t, err)
			require.Equal(t, time.Second*2, step)
		})

		t.Run("survive interval=0 and resolution=0", func(t *testing.T) {
			// resolution=0 and interval=0. this should never happen, but we make sure we return something sane
			// (in this case safeInterval will take care of the problem)
			step, err := calculateStep(time.Second*0, time.Second*22000, 0, nil)
			require.NoError(t, err)
			require.Equal(t, time.Second*2, step)
		})
	})
}
