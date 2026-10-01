package resource

import (
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/require"
)

func requireGeneratedResourceVersion(t *testing.T, g resourceVersionGenerator) int64 {
	t.Helper()
	rv, err := g.Generate()
	require.NoError(t, err)
	return rv
}

func requireResourceVersionFailure(t *testing.T, g resourceVersionGenerator, reason string) {
	t.Helper()
	rv, err := g.Generate()
	require.Zero(t, rv)
	var failure *resourceVersionGenerationError
	require.ErrorAs(t, err, &failure)
	require.Equal(t, reason, failure.reason)
}

func TestProcessResourceVersionGeneratorNodeID(t *testing.T) {
	g, ok := processResourceVersions.(*snowflakeResourceVersionGenerator)
	require.True(t, ok)
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

func TestResourceVersionGeneratorClockRegression(t *testing.T) {
	now := time.Now()
	g := newResourceVersionGenerator(1, func() time.Time { return now })
	first := requireGeneratedResourceVersion(t, g)
	now = now.Add(-38 * time.Second)
	requireResourceVersionFailure(t, g, resourceVersionClockRegression)
	requireResourceVersionFailure(t, g, resourceVersionClockRegression)
	now = now.Add(38 * time.Second)
	require.Equal(t, first+1, requireGeneratedResourceVersion(t, g))
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

func TestResourceVersionGeneratorSequenceWaitClockFailure(t *testing.T) {
	for _, reason := range []string{resourceVersionClockRegression, resourceVersionTimestampOutOfRange} {
		t.Run(reason, func(t *testing.T) {
			now := time.Now()
			invalid := now.Add(-time.Millisecond)
			if reason == resourceVersionTimestampOutOfRange {
				now = time.UnixMilli(resourceVersionEpoch + resourceVersionMaxTimestamp)
				invalid = now.Add(time.Millisecond)
			}
			samples := 0
			g := newResourceVersionGenerator(1, func() time.Time {
				samples++
				if samples == 1 {
					return now
				}
				return invalid
			})
			g.lastMillis = now.UnixMilli()
			g.sequence = resourceVersionMaxSequence
			requireResourceVersionFailure(t, g, reason)
			require.Equal(t, 2, samples)
			require.Equal(t, now.UnixMilli(), g.lastMillis)
			require.Equal(t, resourceVersionMaxSequence, g.sequence)
		})
	}
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
