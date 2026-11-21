package resource

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// clockKV reports a database clock offset from the local clock.
type clockKV struct {
	KV
	offset atomic.Int64
}

func (c *clockKV) UnixTimestamp(context.Context) (int64, error) {
	return time.Now().Add(time.Duration(c.offset.Load())).UnixMilli(), nil
}

func TestReadKVClock(t *testing.T) {
	store := &clockKV{}
	store.offset.Store(int64(time.Hour))

	before := time.Now().Add(time.Hour).Truncate(time.Millisecond)
	got, err := readKVClock(t.Context(), store)
	require.NoError(t, err)
	require.False(t, got.Before(before))
	require.Less(t, got.Sub(before), time.Second)
}

func TestClockOffset(t *testing.T) {
	before := time.Unix(1000, 0)
	after := before.Add(100 * time.Millisecond)
	midpoint := before.Add(50 * time.Millisecond)
	// The database time is truncated, so it is taken half a millisecond later.
	const truncation = time.Millisecond / 2
	// The real offset is within this of the estimate wherever in the round
	// trip the database read its clock.
	const uncertainty = 50*time.Millisecond + truncation
	for _, tc := range []struct {
		name string
		db   time.Time
		want time.Duration
	}{
		{name: "database read at the midpoint", db: midpoint, want: -truncation},
		{name: "behind", db: midpoint.Add(300 * time.Millisecond), want: -300*time.Millisecond - truncation},
		{name: "ahead", db: midpoint.Add(-300 * time.Millisecond), want: 300*time.Millisecond - truncation},
		// Taking the smallest offset consistent with the readings would report
		// zero here, although the clock is most likely 40ms ahead.
		{name: "ahead within the round trip", db: before.Add(10 * time.Millisecond), want: 40*time.Millisecond - truncation},
		// Most of the delay came before the database read its clock, so the
		// estimate is off by almost the whole uncertainty.
		{name: "asymmetric delay", db: after.Add(-time.Millisecond), want: -49*time.Millisecond - truncation},
	} {
		t.Run(tc.name, func(t *testing.T) {
			offset, gotUncertainty := clockOffset(before, after, tc.db)
			require.Equal(t, tc.want, offset)
			require.Equal(t, uncertainty, gotUncertainty)
		})
	}
}

func newTestClockSkewChecker(t *testing.T, read func(context.Context) (time.Time, error)) (*clockSkewChecker, *fakeLogger, *kvBackendMetrics) {
	t.Helper()
	logger := newFakeLogger()
	metrics := newKVBackendMetrics(prometheus.NewRegistry())
	return newClockSkewChecker(read, logger, metrics), logger, metrics
}

// readingNow is a reading of offset taken at the current instant.
func readingNow(offset, uncertainty time.Duration) *clockReading {
	return &clockReading{offset: offset, uncertainty: uncertainty, at: sampleClock()}
}

// shiftedClock returns local clock samples whose wall clock is shift.Load()
// away from the real one, as if the clock had been stepped.
func shiftedClock(shift *atomic.Int64) func() clockSample {
	return func() clockSample {
		now := sampleClock()
		now.wall = now.wall.Add(time.Duration(shift.Load()))
		return now
	}
}

func TestClockReadingEstimate(t *testing.T) {
	at := sampleClock()
	reading := &clockReading{offset: 100 * time.Millisecond, at: at}

	t.Run("time passing keeps the offset", func(t *testing.T) {
		later := clockSample{wall: at.wall.Add(150 * time.Millisecond), mono: at.mono.Add(150 * time.Millisecond)}
		require.Equal(t, 100*time.Millisecond, reading.estimate(later))
	})

	t.Run("a step of the wall clock moves the offset", func(t *testing.T) {
		stepped := clockSample{wall: at.wall.Add(time.Hour), mono: at.mono}
		require.Equal(t, time.Hour+100*time.Millisecond, reading.estimate(stepped))
	})
}

func TestClockSkewCheckerRecord(t *testing.T) {
	t.Run("within tolerance", func(t *testing.T) {
		c, logger, metrics := newTestClockSkewChecker(t, nil)
		c.record(readingNow(-50*time.Millisecond, 0))

		require.NoError(t, c.checkWrite())
		require.Zero(t, logger.WarnLogs.Calls)
		require.Zero(t, logger.ErrorLogs.Calls)
		require.InDelta(t, -0.05, testutil.ToFloat64(metrics.ClockOffsetFromDatabase), 1e-9)
	})

	for _, offset := range []time.Duration{-200 * time.Millisecond, 200 * time.Millisecond} {
		t.Run("warns at "+offset.String(), func(t *testing.T) {
			c, logger, _ := newTestClockSkewChecker(t, nil)
			c.record(readingNow(offset, 0))

			require.NoError(t, c.checkWrite())
			require.Equal(t, 1, logger.WarnLogs.Calls)
			require.Zero(t, logger.ErrorLogs.Calls)
		})
	}

	// Two instances each half the tolerated skew from the database, on opposite
	// sides, are the full tolerated skew apart. The estimate jitters by
	// nanoseconds between the wall and monotonic reads, so stay a millisecond
	// inside the limit.
	t.Run("accepts writes just under half the tolerated skew", func(t *testing.T) {
		c, _, _ := newTestClockSkewChecker(t, nil)
		c.record(readingNow(249*time.Millisecond, 0))
		require.NoError(t, c.checkWrite())
	})

	// Only the uncertainty keeps the clock from being a safe distance away.
	t.Run("rejects writes that may be beyond the limit", func(t *testing.T) {
		c, logger, _ := newTestClockSkewChecker(t, nil)
		c.record(readingNow(200*time.Millisecond, 100*time.Millisecond))
		require.Error(t, c.checkWrite())
		require.Equal(t, 1, logger.ErrorLogs.Calls)

		c.record(readingNow(0, 125*time.Millisecond))
		require.NoError(t, c.checkWrite())
	})

	for _, offset := range []time.Duration{-300 * time.Millisecond, 300 * time.Millisecond} {
		t.Run("rejects writes and recovers at "+offset.String(), func(t *testing.T) {
			c, logger, metrics := newTestClockSkewChecker(t, nil)
			c.record(readingNow(offset, 0))

			err := c.checkWrite()
			require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
			// Clients see no offsets or limits.
			require.ErrorContains(t, err, errClockNotSynchronized)
			require.NotContains(t, err.Error(), "300ms")
			require.Equal(t, 1, logger.ErrorLogs.Calls)
			require.Equal(t, 1.0, testutil.ToFloat64(metrics.ClockSkewRejectedWrites))

			c.record(readingNow(0, 0))
			require.NoError(t, c.checkWrite())
			require.Equal(t, 1, logger.InfoLogs.Calls)
		})
	}

	t.Run("nil checker accepts writes", func(t *testing.T) {
		var c *clockSkewChecker
		require.NoError(t, c.checkWrite())
	})
}

func TestClockSkewCheckerRejectsWritesBeforeTheFirstCheck(t *testing.T) {
	var fail atomic.Bool
	fail.Store(true)
	c, _, metrics := newTestClockSkewChecker(t, func(context.Context) (time.Time, error) {
		if fail.Load() {
			return time.Time{}, errors.New("database unavailable")
		}
		return time.Now(), nil
	})

	c.check(t.Context())
	err := c.checkWrite()
	require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
	require.Equal(t, 1.0, testutil.ToFloat64(metrics.ClockSkewRejectedWrites))
	require.Empty(t, c.recheck, "a failing database is not asked again on every write")

	fail.Store(false)
	c.check(t.Context())
	require.NoError(t, c.checkWrite())
}

func TestClockSkewCheckerDiscardsSamplesSpanningAJump(t *testing.T) {
	var jump atomic.Int64
	c, logger := jumpingChecker(t, &jump)
	jumpDuringRead := func(by time.Duration) {
		var stepped atomic.Bool
		c.readDBClock = func(context.Context) (time.Time, error) {
			if stepped.Swap(true) {
				return time.Now(), nil
			}
			// The database answers halfway through the step, so its time falls
			// between the local readings and the sample alone shows no offset.
			jump.Store(int64(by))
			return time.Now().Add(by / 2), nil
		}
	}

	t.Run("the next attempt measures the step", func(t *testing.T) {
		jumpDuringRead(time.Hour)
		c.check(t.Context())
		require.Equal(t, 1, logger.WarnLogs.Calls)
		require.InDelta(t, time.Hour, c.last.Load().offset, float64(time.Millisecond))
		require.Error(t, c.checkWrite())
	})

	t.Run("with a previous reading the jump is still seen", func(t *testing.T) {
		jump.Store(0)
		c.readDBClock = func(context.Context) (time.Time, error) { return time.Now(), nil }
		c.check(t.Context())
		require.NoError(t, c.checkWrite())

		jumpDuringRead(time.Hour)
		c.check(t.Context())
		require.Error(t, c.checkWrite())
	})
}

// slowDBClock returns a database clock read that is offset from the local
// clock and takes delay.Load(), split evenly around the database reading its
// clock unless lopsided is set, in which case all of it comes first.
func slowDBClock(offset, delay *atomic.Int64, lopsided *atomic.Bool) func(context.Context) (time.Time, error) {
	return func(context.Context) (time.Time, error) {
		d := time.Duration(delay.Load())
		first := d / 2
		if lopsided.Load() {
			first = d
		}
		time.Sleep(first)
		defer time.Sleep(d - first)
		return time.Now().Add(time.Duration(offset.Load())), nil
	}
}

func TestClockSkewCheckerSlowSamples(t *testing.T) {
	// The database clock moves after a healthy check and reads get slower
	// than the allowed offset: the new offset must still be measured.
	t.Run("a slow read replaces a healthy reading", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var offset, delay atomic.Int64
			var lopsided atomic.Bool
			c, _, _ := newTestClockSkewChecker(t, slowDBClock(&offset, &delay, &lopsided))
			c.check(t.Context())
			require.NoError(t, c.checkWrite())

			offset.Store(int64(-time.Second))
			delay.Store(int64(300 * time.Millisecond))
			c.check(t.Context())
			require.Error(t, c.checkWrite())
		})
	})

	// A clock 350ms ahead measures about 200ms ahead when the database reads
	// its clock at the end of a 300ms round trip. Only the uncertainty
	// rejects it.
	t.Run("uncertainty rejects a lopsided read", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var offset, delay atomic.Int64
			var lopsided atomic.Bool
			offset.Store(int64(-350 * time.Millisecond))
			delay.Store(int64(300 * time.Millisecond))
			lopsided.Store(true)
			c, _, _ := newTestClockSkewChecker(t, slowDBClock(&offset, &delay, &lopsided))
			c.check(t.Context())
			require.Less(t, c.last.Load().offset, c.maxOffset)
			require.Error(t, c.checkWrite())
		})
	})

	t.Run("a synchronized clock passes a slow read", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var offset, delay atomic.Int64
			var lopsided atomic.Bool
			delay.Store(int64(300 * time.Millisecond))
			c, _, _ := newTestClockSkewChecker(t, slowDBClock(&offset, &delay, &lopsided))
			c.check(t.Context())
			require.NoError(t, c.checkWrite())
		})
	})

	t.Run("keeps the fastest of the attempts", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var offset, delay atomic.Int64
			var lopsided atomic.Bool
			var reads atomic.Int32
			read := slowDBClock(&offset, &delay, &lopsided)
			c, _, _ := newTestClockSkewChecker(t, func(ctx context.Context) (time.Time, error) {
				// The first read waits for a connection; the next one doesn't.
				if reads.Add(1) == 1 {
					delay.Store(int64(time.Second))
				} else {
					delay.Store(int64(10 * time.Millisecond))
				}
				return read(ctx)
			})
			c.check(t.Context())
			require.Equal(t, int32(2), reads.Load())
			require.Equal(t, 5*time.Millisecond+time.Millisecond/2, c.last.Load().uncertainty)
		})
	})
}

// jumpingChecker returns a checker whose wall clock is offset by jump from the
// real one, against a database clock that is not.
func jumpingChecker(t *testing.T, jump *atomic.Int64) (*clockSkewChecker, *fakeLogger) {
	t.Helper()
	c, logger, _ := newTestClockSkewChecker(t, func(context.Context) (time.Time, error) {
		return time.Now(), nil
	})
	c.now = shiftedClock(jump)
	// Keep the ticker out of the way of tests that run the checker.
	c.interval = time.Hour
	return c, logger
}

func TestClockSkewCheckerDetectsJumpsBetweenChecks(t *testing.T) {
	for _, jumpBy := range []time.Duration{79 * 24 * time.Hour, -time.Hour} {
		t.Run(jumpBy.String(), func(t *testing.T) {
			var jump atomic.Int64
			c, logger := jumpingChecker(t, &jump)
			c.check(t.Context())
			require.NoError(t, c.checkWrite())

			jump.Store(int64(jumpBy))
			err := c.checkWrite()
			require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
			require.Equal(t, 1, logger.ErrorLogs.Calls)
			require.Len(t, c.recheck, 1, "a jump asks for a check against the database")

			// Later writes keep failing without logging the transition again.
			require.Error(t, c.checkWrite())
			require.Equal(t, 1, logger.ErrorLogs.Calls)

			jump.Store(0)
			require.NoError(t, c.checkWrite())
			require.Equal(t, 1, logger.InfoLogs.Calls)
		})
	}
}

func TestClockSkewCheckerAcceptsAJumpThatFixesTheClock(t *testing.T) {
	var jump atomic.Int64
	jump.Store(int64(time.Hour))
	c, _ := jumpingChecker(t, &jump)
	c.check(t.Context())
	require.Error(t, c.checkWrite())

	// Time synchronization steps the clock back to the database's.
	jump.Store(0)
	require.NoError(t, c.checkWrite())
}

func TestClockSkewCheckerRechecksAfterAJump(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var jump atomic.Int64
		var reads atomic.Int32
		c, _ := jumpingChecker(t, &jump)
		read := c.readDBClock
		c.readDBClock = func(ctx context.Context) (time.Time, error) {
			reads.Add(1)
			return read(ctx)
		}
		c.check(t.Context())

		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		go c.run(ctx)

		jump.Store(int64(time.Hour))
		require.Error(t, c.checkWrite())
		synctest.Wait()
		// The interval is an hour, so this read came from the jump.
		require.Equal(t, int32(2), reads.Load())
		// The delta allows for the database truncating to the millisecond.
		require.InDelta(t, time.Hour, c.last.Load().offset, float64(time.Millisecond))
	})
}

func TestClockSkewCheckerExpiresReadings(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var fail atomic.Bool
		c, logger, _ := newTestClockSkewChecker(t, func(context.Context) (time.Time, error) {
			if fail.Load() {
				return time.Time{}, errors.New("clock read failed")
			}
			return time.Now(), nil
		})
		c.check(t.Context())
		require.NoError(t, c.checkWrite())

		fail.Store(true)
		time.Sleep(clockReadingMaxIntervals * c.interval)
		c.check(t.Context())
		require.NoError(t, c.checkWrite(), "a reading stays valid for its maximum age")

		time.Sleep(time.Millisecond)
		require.Error(t, c.checkWrite())
		require.Equal(t, 1, logger.ErrorLogs.Calls)
		require.Len(t, c.recheck, 1)

		fail.Store(false)
		c.check(t.Context())
		require.NoError(t, c.checkWrite())
	})
}

func TestClockSkewCheckerKeepsLastResultOnReadError(t *testing.T) {
	var fail atomic.Bool
	c, logger, _ := newTestClockSkewChecker(t, func(context.Context) (time.Time, error) {
		if fail.Load() {
			return time.Time{}, errors.New("database unavailable")
		}
		return time.Now().Add(time.Minute), nil
	})

	c.check(t.Context())
	require.Error(t, c.checkWrite())

	fail.Store(true)
	c.check(t.Context())
	require.Error(t, c.checkWrite())
	require.Equal(t, 1, logger.WarnLogs.Calls)
}

func TestClockSkewCheckerRun(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var offset atomic.Int64
		offset.Store(int64(time.Minute))
		c, _, _ := newTestClockSkewChecker(t, func(context.Context) (time.Time, error) {
			return time.Now().Add(time.Duration(offset.Load())), nil
		})

		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		go c.run(ctx)

		time.Sleep(c.interval)
		synctest.Wait()
		require.Error(t, c.checkWrite())

		offset.Store(0)
		time.Sleep(c.interval)
		synctest.Wait()
		require.NoError(t, c.checkWrite())
	})
}

// Incremental search indexing reads back searchLookback behind its checkpoint
// to pick up writes from instances whose clocks are behind the one that set
// it. Instances passing the check can be up to lease.MaxClockSkew apart, so a
// larger skew would let indexing miss their writes.
func TestClockSkewFitsSearchLookback(t *testing.T) {
	require.Less(t, lease.MaxClockSkew, defaultSearchLookback)

	// An empty config gets the setting's default.
	cfg, err := setting.NewCfgFromBytes(nil)
	require.NoError(t, err)
	require.Less(t, lease.MaxClockSkew, cfg.SearchLookback)
}

func TestKVBackendClockSkewCheck(t *testing.T) {
	newBackend := func(t *testing.T, enabled bool, dbOffset time.Duration) *kvStorageBackend {
		store := &clockKV{}
		store.offset.Store(int64(dbOffset))
		return setupTestStorageBackend(t, func(opts *KVBackendOptions) {
			store.KV = opts.KvStore
			opts.KvStore = store
			opts.ClockSkewCheck = enabled
		})
	}

	for _, dbOffset := range []time.Duration{-time.Minute, time.Minute} {
		t.Run("rejects writes when the clock is too far off by "+dbOffset.String(), func(t *testing.T) {
			backend := newBackend(t, true, dbOffset)
			_, err := writeEvent(t, t.Context(), backend, "item", resourcepb.WatchEvent_ADDED)
			require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
		})
	}

	t.Run("accepts writes when the clock is in sync", func(t *testing.T) {
		backend := newBackend(t, true, 0)
		_, err := writeEvent(t, t.Context(), backend, "item", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
	})

	t.Run("rejects bulk imports before taking leases", func(t *testing.T) {
		backend := newBackend(t, true, time.Minute)
		_, err := backend.ProcessBulk(t.Context(), BulkSettings{
			Collection: []*resourcepb.ResourceKey{{Namespace: "ns", Group: "group", Resource: "resource"}},
		}, nil)
		require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)

		for key, err := range backend.kv.Keys(t.Context(), kv.LeasesSection, kv.ListOptions{}) {
			require.NoError(t, err)
			require.NotContains(t, key, "bulk/", "the rejected import took a lease")
		}
	})

	t.Run("does not check when disabled", func(t *testing.T) {
		backend := newBackend(t, false, time.Minute)
		require.Nil(t, backend.clockSkew)
		_, err := writeEvent(t, t.Context(), backend, "item", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
	})
}
