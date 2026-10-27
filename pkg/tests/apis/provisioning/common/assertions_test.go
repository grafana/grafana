package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestConsistently(t *testing.T) {
	t.Run("samples for the whole window", func(t *testing.T) {
		// samples is deliberately a plain int: if check ever ran in a goroutine of
		// its own, -race would flag this.
		samples := 0
		start := time.Now()
		Consistently(t, func(t *testing.T) { samples++ }, 300*time.Millisecond, 50*time.Millisecond)

		assert.GreaterOrEqual(t, time.Since(start), 300*time.Millisecond, "must not return before the window elapses")
		assert.Greater(t, samples, 1, "must sample more than once")
	})

	t.Run("samples once when waitFor is zero", func(t *testing.T) {
		samples := 0
		Consistently(t, func(t *testing.T) { samples++ }, 0, 50*time.Millisecond)
		assert.Equal(t, 1, samples)
	})

	t.Run("no check is still in flight when it returns", func(t *testing.T) {
		// A probe outliving the call is the require.Never bug this helper exists to
		// avoid: it is what sees a cancelled t.Context() after the test body ends.
		inFlight := make(chan struct{}, 16)
		Consistently(t, func(t *testing.T) {
			inFlight <- struct{}{}
			time.Sleep(20 * time.Millisecond)
			<-inFlight
		}, 100*time.Millisecond, 10*time.Millisecond)

		assert.Empty(t, inFlight, "no check may still be running once Consistently returns")
	})

	t.Run("a slow check does not cut the window short", func(t *testing.T) {
		samples := 0
		Consistently(t, func(t *testing.T) {
			samples++
			time.Sleep(60 * time.Millisecond)
		}, 100*time.Millisecond, 10*time.Millisecond)

		assert.Greater(t, samples, 1, "a check slower than the tick must still be sampled repeatedly")
	})
}
