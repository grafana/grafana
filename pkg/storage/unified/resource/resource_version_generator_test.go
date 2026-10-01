package resource

import (
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/require"
)

func requireGeneratedResourceVersion(t *testing.T, g *snowflakeResourceVersionGenerator) int64 {
	t.Helper()
	rv, err := g.Generate()
	require.NoError(t, err)
	return rv
}

func requireResourceVersionFailure(t *testing.T, g *snowflakeResourceVersionGenerator, reason string) {
	t.Helper()
	rv, err := g.Generate()
	require.Zero(t, rv)
	var failure *resourceVersionGenerationError
	require.ErrorAs(t, err, &failure)
	require.Equal(t, reason, failure.reason)
}

func TestProcessResourceVersionGeneratorNodeID(t *testing.T) {
	g := processResourceVersions
	require.GreaterOrEqual(t, g.node, int64(0))
	require.Less(t, g.node, int64(1<<resourceVersionNodeBits))
}

func TestResourceVersionGeneratorWallTime(t *testing.T) {
	now := time.Now()
	g := newResourceVersionGenerator(42, func() time.Time { return now })
	first := requireGeneratedResourceVersion(t, g)
	require.Equal(t, now.UnixMilli(), snowflake.ID(first).Time())
	require.EqualValues(t, 42, snowflake.ID(first).Node())
	require.Zero(t, snowflake.ID(first).Step())
	previous := first
	for range 100 {
		rv := requireGeneratedResourceVersion(t, g)
		require.Greater(t, rv, previous)
		require.Equal(t, now.UnixMilli(), snowflake.ID(rv).Time())
		previous = rv
	}
	now = now.Add(38 * time.Second)
	jumped := requireGeneratedResourceVersion(t, g)
	require.EqualValues(t, 38000, snowflake.ID(jumped).Time()-snowflake.ID(first).Time())
	require.Greater(t, jumped, previous)
	require.Zero(t, snowflake.ID(jumped).Step())
}

func TestResourceVersionGeneratorClockAdjustments(t *testing.T) {
	start := time.Now().Round(0)
	type clockStep struct {
		// All offsets are relative to start, including the expected RV timestamp.
		wall, monotonic, expected time.Duration
	}
	tests := []struct {
		name  string
		steps []clockStep
	}{
		{
			name: "backward wall correction before first RV",
			steps: []clockStep{
				// The constructor's baseline must survive a correction before the first generation.
				{-100 * time.Millisecond, 0, 0},
				{-90 * time.Millisecond, 10 * time.Millisecond, 10 * time.Millisecond},
			},
		},
		{
			name: "backward wall correction",
			steps: []clockStep{
				{0, 0, 0},
				// Wall time moves back 100ms; the RV stays at the baseline and advances its sequence.
				{-100 * time.Millisecond, 0, 0},
				// Both clocks advance 10ms; the RV follows monotonic time despite the wall-clock offset.
				{-90 * time.Millisecond, 10 * time.Millisecond, 10 * time.Millisecond},
				// Continued progress retains the 100ms lead over wall time without rebasing backward.
				{100 * time.Millisecond, 200 * time.Millisecond, 200 * time.Millisecond},
			},
		},
		{
			name: "suspension then backward wall correction",
			steps: []clockStep{
				{0, 0, 0},
				// Wall time advances 38s while monotonic time advances 1s; rebase to recover the missing 37s.
				{38 * time.Second, time.Second, 38 * time.Second},
				// Both clocks advance 10ms; monotonic progress must use the new baseline.
				{38010 * time.Millisecond, 1010 * time.Millisecond, 38010 * time.Millisecond},
				// A 100ms backward wall correction during another 10ms of progress must not decrease the RV.
				{37920 * time.Millisecond, 1020 * time.Millisecond, 38020 * time.Millisecond},
				// Another forward discrepancy must rebase again, even after the backward correction.
				{76 * time.Second, 2 * time.Second, 76 * time.Second},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			now := start
			var monotonic, baselineMonotonic time.Duration
			g := newResourceVersionGenerator(1, func() time.Time { return now })
			// Go does not expose construction of independent wall and monotonic readings.
			g.elapsed = func(time.Time, time.Time) time.Duration { return monotonic - baselineMonotonic }
			var previous int64
			for _, step := range tt.steps {
				now = start.Add(step.wall)
				monotonic = step.monotonic
				rv := requireGeneratedResourceVersion(t, g)
				require.Equal(t, start.Add(step.expected).UnixMilli(), snowflakeTimestampMillis(rv))
				require.Greater(t, rv, previous)
				if g.baseline == now {
					baselineMonotonic = monotonic
				}
				previous = rv
			}
		})
	}
}

func TestResourceVersionGeneratorSequenceExhaustion(t *testing.T) {
	now := time.Now()
	g := newResourceVersionGenerator(1, func() time.Time { return now })
	var previous int64
	for range 4096 {
		rv := requireGeneratedResourceVersion(t, g)
		require.Greater(t, rv, previous)
		previous = rv
	}
	require.EqualValues(t, 4095, snowflake.ID(previous).Step())
	samples := 0
	g.now = func() time.Time {
		samples++
		if samples <= 3 {
			return now
		}
		return now.Add(time.Millisecond)
	}
	rv := requireGeneratedResourceVersion(t, g)
	require.Equal(t, 4, samples, "generation must wait until wall time advances")
	require.Greater(t, rv, previous)
	require.Equal(t, now.UnixMilli()+1, snowflake.ID(rv).Time())
	require.Zero(t, snowflake.ID(rv).Step())
}

func TestResourceVersionGeneratorSequenceWaitTimestampOutOfRange(t *testing.T) {
	now := time.UnixMilli(resourceVersionEpoch + resourceVersionMaxTimestamp)
	samples := 0
	g := newResourceVersionGenerator(1, func() time.Time { return now })
	g.now = func() time.Time {
		samples++
		if samples == 1 {
			return now
		}
		return now.Add(time.Millisecond)
	}
	g.lastMillis = now.UnixMilli()
	g.sequence = resourceVersionMaxSequence
	requireResourceVersionFailure(t, g, resourceVersionTimestampOutOfRange)
	require.Equal(t, 2, samples)
	require.Equal(t, now.UnixMilli(), g.lastMillis)
	require.Equal(t, resourceVersionMaxSequence, g.sequence)
}

func TestResourceVersionGeneratorTimestampRange(t *testing.T) {
	for _, millis := range []int64{snowflake.Epoch - 1, snowflake.Epoch + resourceVersionMaxTimestamp + 1} {
		t.Run(time.UnixMilli(millis).String(), func(t *testing.T) {
			now := time.UnixMilli(millis)
			g := newResourceVersionGenerator(1023, func() time.Time { return now })
			requireResourceVersionFailure(t, g, resourceVersionTimestampOutOfRange)
			require.Zero(t, g.lastMillis)
			require.Zero(t, g.sequence)
		})
	}
	for _, millis := range []int64{snowflake.Epoch, snowflake.Epoch + resourceVersionMaxTimestamp} {
		now := time.UnixMilli(millis)
		g := newResourceVersionGenerator(1023, func() time.Time { return now })
		rv := requireGeneratedResourceVersion(t, g)
		require.Greater(t, rv, int64(0))
		require.Equal(t, millis, snowflake.ID(rv).Time())
	}
}

func TestResourceVersionGeneratorInvalidRebaseRecovery(t *testing.T) {
	start := time.Now()
	now := start
	var elapsed time.Duration
	g := newResourceVersionGenerator(1, func() time.Time { return now })
	g.elapsed = func(time.Time, time.Time) time.Duration { return elapsed }
	first := requireGeneratedResourceVersion(t, g)

	now = time.UnixMilli(resourceVersionEpoch + resourceVersionMaxTimestamp + 1)
	elapsed = time.Millisecond
	requireResourceVersionFailure(t, g, resourceVersionTimestampOutOfRange)
	require.Equal(t, start, g.baseline, "an invalid forward jump must not replace the baseline")

	now = start.Add(time.Millisecond)
	rv := requireGeneratedResourceVersion(t, g)
	require.Greater(t, rv, first)
	require.Equal(t, now.UnixMilli(), snowflakeTimestampMillis(rv))
}

func TestResourceVersionGeneratorConcurrent(t *testing.T) {
	now := time.Now()
	samples := 0
	g := newResourceVersionGenerator(1, func() time.Time {
		samples++
		// Two extra clock reads per millisecond exercise waiting at sequence capacity.
		return now.Add(time.Duration((samples-1)/4098) * time.Millisecond)
	})
	const workers, perWorker = 32, 256
	ids := make([]int64, workers*perWorker)
	errs := make([]error, workers*perWorker)
	var wg sync.WaitGroup
	for worker := range workers {
		wg.Go(func() {
			for i := range perWorker {
				index := worker*perWorker + i
				ids[index], errs[index] = g.Generate()
			}
		})
	}
	wg.Wait()
	for _, err := range errs {
		require.NoError(t, err)
	}
	require.Greater(t, samples, len(ids), "concurrent generation must wait at sequence capacity")
	slices.Sort(ids)
	for i, rv := range ids {
		require.Equal(t, now.UnixMilli()+int64(i/4096), snowflake.ID(rv).Time())
		require.EqualValues(t, i%4096, snowflake.ID(rv).Step())
		if i > 0 {
			require.Greater(t, rv, ids[i-1])
		}
	}
}

func TestResourceVersionTimestampCompatibility(t *testing.T) {
	require.Equal(t, snowflake.Epoch, resourceVersionEpoch)
	require.EqualValues(t, snowflake.NodeBits, resourceVersionNodeBits)
	require.EqualValues(t, snowflake.StepBits, resourceVersionSequenceBits)
	for _, rv := range []int64{0, 1, -1, 1<<63 - 1, -1 << 63, snowflakeFromTime(time.Now())} {
		require.Equal(t, snowflake.ID(rv).Time(), snowflakeTimestampMillis(rv))
	}
}

func TestResourceVersionGeneratorCompatibility(t *testing.T) {
	old, err := snowflake.NewNode(42)
	require.NoError(t, err)
	oldRV := old.Generate().Int64()
	now := time.UnixMilli(snowflake.ID(oldRV).Time())
	g := newResourceVersionGenerator(42, func() time.Time { return now })
	g.sequence = snowflake.ID(oldRV).Step()
	g.lastMillis = now.UnixMilli()
	newRV := requireGeneratedResourceVersion(t, g)
	require.Equal(t, oldRV+1, newRV)
	now = now.Add(38 * time.Second)
	laterRV := requireGeneratedResourceVersion(t, g)
	ids := []int64{laterRV, newRV, oldRV}
	slices.Sort(ids)
	require.Equal(t, []int64{oldRV, newRV, laterRV}, ids)
	require.Equal(t, snowflake.ID(oldRV).Time(), snowflake.ID(newRV).Time())
	require.Equal(t, now.UnixMilli(), snowflake.ID(laterRV).Time())
}
