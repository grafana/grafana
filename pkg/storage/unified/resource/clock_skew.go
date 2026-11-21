package resource

import (
	"context"
	"sync/atomic"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

const (
	clockSkewCheckInterval = 10 * time.Second
	clockSkewCheckTimeout  = 5 * time.Second
	// clockSkewWarnThreshold logs a warning while the clock is at least this
	// far from the database clock, before writes are rejected.
	clockSkewWarnThreshold = 100 * time.Millisecond
	clockSampleTolerance   = time.Millisecond
	// clockSampleAttempts bounds how many times a check reads the database
	// clock looking for a round trip short enough to be conclusive.
	clockSampleAttempts = 3
	// clockReadingMaxIntervals is how many check intervals a reading stays
	// valid, so writes stop if the checks keep failing.
	clockReadingMaxIntervals = 3

	errClockNotSynchronized = "writes are temporarily unavailable because the server clock is not synchronized; contact your administrator"
)

func readKVClock(ctx context.Context, store KV) (time.Time, error) {
	millis, err := store.UnixTimestamp(ctx)
	if err != nil {
		return time.Time{}, err
	}
	return time.UnixMilli(millis), nil
}

// clockSample is the local wall and monotonic clocks taken from a single
// time.Now, so that a pause between two reads cannot look like a clock jump.
type clockSample struct {
	// wall has no monotonic reading, so Sub on it compares wall clocks.
	wall time.Time
	mono time.Time
}

func sampleClock() clockSample {
	now := time.Now()
	// Round(0) drops the monotonic reading, which Sub would otherwise prefer.
	return clockSample{wall: now.Round(0), mono: now}
}

// clockOffset estimates how far the local clock is ahead of the database
// (negative when behind), assuming the database read its clock halfway through
// the round trip. The error is at most half the round trip, plus half a
// millisecond because the database time is truncated to milliseconds; it is
// returned as uncertainty.
func clockOffset(before, after, db time.Time) (offset, uncertainty time.Duration) {
	half := after.Sub(before) / 2
	offset = before.Add(half).Sub(db.Add(time.Millisecond / 2))
	return offset, half + time.Millisecond/2
}

// clockReading is the offset from the database measured at one instant.
type clockReading struct {
	offset time.Duration
	// uncertainty bounds how far the real offset may be from offset.
	uncertainty time.Duration
	at          clockSample
}

// estimate returns the current offset from the database. A step of the wall
// clock since the reading moves wall time but not monotonic time, so the
// difference between the two is how far the clock jumped.
//
// The monotonic clock also stops while the host is suspended, so a resumed
// host looks like it jumped ahead until the next check measures it again.
func (r *clockReading) estimate(now clockSample) time.Duration {
	return r.offset + now.wall.Sub(r.at.wall) - now.mono.Sub(r.at.mono)
}

// clockSkewChecker rejects writes while this process's clock is too far from
// the database clock.
//
// Write leases compare expiry times written by one instance against the clock
// of another, and resource versions come from the clock of the instance that
// handles the write. Both assume the instances sharing a database agree on the
// time within lease.MaxClockSkew, and so does incremental search indexing,
// which looks back searchLookback behind its checkpoint for writes from slower
// instances.
type clockSkewChecker struct {
	interval       time.Duration
	warnThreshold  time.Duration
	maxOffset      time.Duration
	readDBClock    func(context.Context) (time.Time, error)
	now            func() clockSample
	log            logging.Logger
	offsetGauge    prometheus.Gauge
	rejectedWrites prometheus.Counter

	// last is nil until the first successful check, and writes are rejected
	// until then.
	last atomic.Pointer[clockReading]
	// rejecting only tracks the state for logging transitions; writes are
	// decided from last on every call.
	rejecting atomic.Bool
	// recheck asks run to measure again without waiting for the next tick.
	recheck chan struct{}
}

func newClockSkewChecker(readDBClock func(context.Context) (time.Time, error), log logging.Logger, metrics *kvBackendMetrics) *clockSkewChecker {
	return &clockSkewChecker{
		interval:      clockSkewCheckInterval,
		warnThreshold: clockSkewWarnThreshold,
		// Two instances each this far from the database, on opposite sides,
		// are lease.MaxClockSkew apart.
		maxOffset:      lease.MaxClockSkew / 2,
		readDBClock:    readDBClock,
		now:            sampleClock,
		log:            log,
		offsetGauge:    metrics.ClockOffsetFromDatabase,
		rejectedWrites: metrics.ClockSkewRejectedWrites,
		recheck:        make(chan struct{}, 1),
	}
}

func (c *clockSkewChecker) run(ctx context.Context) {
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.check(ctx)
		case <-c.recheck:
			c.check(ctx)
		}
	}
}

func (c *clockSkewChecker) requestCheck() {
	select {
	case c.recheck <- struct{}{}:
	default:
	}
}

func (c *clockSkewChecker) check(ctx context.Context) {
	readCtx, cancel := context.WithTimeout(ctx, clockSkewCheckTimeout)
	defer cancel()

	var best *clockReading
	for range clockSampleAttempts {
		reading, err := c.sample(readCtx)
		if err != nil {
			if ctx.Err() == nil {
				// Keep the last reading until it expires: writes fail anyway
				// while the database is unreachable.
				c.log.Warn("Failed to read the database clock for the clock skew check", "error", err)
			}
			break
		}
		if reading != nil && (best == nil || reading.uncertainty < best.uncertainty) {
			best = reading
		}
		// A slow read, such as one waiting for a pooled connection, counts
		// against the limit through its uncertainty, so try for a faster one.
		if best != nil && 2*best.uncertainty <= c.maxOffset {
			break
		}
	}
	if best != nil {
		c.record(best)
	}
}

// sample reads the database clock once. It returns nil when the local clock
// moved during the read.
func (c *clockSkewChecker) sample(ctx context.Context) (*clockReading, error) {
	before := c.now()
	dbNow, err := c.readDBClock(ctx)
	after := c.now()
	if err != nil {
		return nil, err
	}
	// A step during the read can put the database time between before and
	// after, which looks like no offset at all. Keeping the previous reading
	// instead lets checkWrite see the step.
	roundTrip := after.mono.Sub(before.mono)
	if jump := after.wall.Sub(before.wall) - roundTrip; jump > clockSampleTolerance || jump < -clockSampleTolerance {
		c.log.Warn("Clock moved during the clock skew check, discarding the sample", "jump", jump.String())
		return nil, nil
	}
	offset, uncertainty := clockOffset(before.wall, after.wall, dbNow)
	return &clockReading{offset: offset, uncertainty: uncertainty, at: after}, nil
}

// tooFar reports whether the offset may be beyond maxOffset given how
// uncertain it is.
func (c *clockSkewChecker) tooFar(magnitude, uncertainty time.Duration) bool {
	return magnitude+uncertainty > c.maxOffset
}

func (c *clockSkewChecker) record(reading *clockReading) {
	c.last.Store(reading)
	offset := reading.offset
	c.offsetGauge.Set(offset.Seconds())

	magnitude, direction := offsetMagnitude(offset)
	tooFar := c.tooFar(magnitude, reading.uncertainty)
	wasRejecting := c.rejecting.Swap(tooFar)
	switch {
	case tooFar:
		c.log.Error("Clock is too far from the database clock, rejecting writes",
			"offset", magnitude.String(), "direction", direction, "uncertainty", reading.uncertainty.String(), "maxOffset", c.maxOffset.String())
	case magnitude >= c.warnThreshold:
		c.log.Warn("Clock is drifting from the database clock, synchronize it to avoid rejected writes",
			"offset", magnitude.String(), "direction", direction, "warnThreshold", c.warnThreshold.String(), "maxOffset", c.maxOffset.String())
	}
	if wasRejecting && !tooFar {
		c.log.Info("Clock is back within the allowed offset from the database clock, accepting writes",
			"offset", magnitude.String(), "direction", direction)
	}
}

func offsetMagnitude(offset time.Duration) (time.Duration, string) {
	if offset < 0 {
		return -offset, "behind"
	}
	return offset, "ahead"
}

// checkWrite returns an error while the local clock cannot be trusted: before
// the first successful check, when the last one is too old, or while the clock
// may be too far from the database clock.
// It extrapolates from the last check, so a clock that jumps between checks
// stops writes right away instead of on the next tick.
//
// It runs once when a write or bulk import starts, not before every use of the
// clock within it: it is a safety net against a skewed clock, not a guarantee
// for a clock that jumps mid-request.
// The message reaches API clients, so the offset and limits stay in the checker's logs.
func (c *clockSkewChecker) checkWrite() error {
	if c == nil {
		return nil
	}
	last := c.last.Load()
	if last == nil {
		c.rejectedWrites.Inc()
		return apierrors.NewServiceUnavailable(errClockNotSynchronized)
	}
	now := c.now()
	magnitude, direction := offsetMagnitude(last.estimate(now))
	age := now.mono.Sub(last.at.mono)
	maxAge := clockReadingMaxIntervals * c.interval
	stale := age > maxAge
	tooFar := stale || c.tooFar(magnitude, last.uncertainty)
	if c.rejecting.CompareAndSwap(!tooFar, tooFar) {
		switch {
		case stale:
			c.log.Error("No recent clock skew check, rejecting writes",
				"age", age.String(), "maxAge", maxAge.String())
		case tooFar:
			c.log.Error("Clock moved since the last clock skew check, rejecting writes",
				"offset", magnitude.String(), "direction", direction, "uncertainty", last.uncertainty.String(), "maxOffset", c.maxOffset.String())
		default:
			c.log.Info("Clock moved back within the allowed offset from the database clock, accepting writes",
				"offset", magnitude.String(), "direction", direction)
		}
		// Confirm against the database instead of trusting the estimate until the next tick.
		c.requestCheck()
	}
	if !tooFar {
		return nil
	}
	c.rejectedWrites.Inc()
	return apierrors.NewServiceUnavailable(errClockNotSynchronized)
}
