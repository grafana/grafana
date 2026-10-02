package resource

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"sync"
	"time"
)

const (
	// The epoch and bit layout are persisted, so changing them would invalidate existing RVs.
	resourceVersionEpoch          = int64(1288834974657)
	resourceVersionNodeBits       = 10
	resourceVersionSequenceBits   = 12
	resourceVersionTimestampShift = resourceVersionNodeBits + resourceVersionSequenceBits
	resourceVersionMaxTimestamp   = int64(1<<41 - 1)
	resourceVersionMaxSequence    = int64(1<<resourceVersionSequenceBits - 1)

	resourceVersionClockRegression     = "clock_regression"
	resourceVersionTimestampOutOfRange = "timestamp_out_of_range"
)

type resourceVersionGenerationError struct {
	reason        string
	currentMillis int64
	lastMillis    int64
}

func (e *resourceVersionGenerationError) Error() string {
	return fmt.Sprintf("resource version generation failed: %s (current time %d, last emitted time %d)", e.reason, e.currentMillis, e.lastMillis)
}

type snowflakeResourceVersionGenerator struct {
	mu         sync.Mutex
	now        func() time.Time
	node       int64
	lastMillis int64
	sequence   int64
}

func newResourceVersionGenerator(node int64, now func() time.Time) *snowflakeResourceVersionGenerator {
	return &snowflakeResourceVersionGenerator{node: node, now: now}
}

// Share the node and sequence across backends so instances in one process cannot
// issue the same resource version.
var processResourceVersions = func() *snowflakeResourceVersionGenerator {
	var nodeBytes [2]byte
	if _, err := rand.Read(nodeBytes[:]); err != nil {
		panic(fmt.Errorf("failed to generate resource version node ID: %w", err))
	}
	node := int64(binary.BigEndian.Uint16(nodeBytes[:])) & (1<<resourceVersionNodeBits - 1)
	return newResourceVersionGenerator(node, time.Now)
}()

func (g *snowflakeResourceVersionGenerator) Generate() (int64, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	for {
		// UnixMilli deliberately discards the monotonic component: persisted RVs must
		// track wall time even after a clock correction.
		now := g.now().UnixMilli()
		if now < resourceVersionEpoch || now > resourceVersionEpoch+resourceVersionMaxTimestamp {
			return 0, &resourceVersionGenerationError{reason: resourceVersionTimestampOutOfRange, currentMillis: now, lastMillis: g.lastMillis}
		}
		if now < g.lastMillis {
			return 0, &resourceVersionGenerationError{reason: resourceVersionClockRegression, currentMillis: now, lastMillis: g.lastMillis}
		}
		sequence := int64(0)
		if now == g.lastMillis {
			if g.sequence == resourceVersionMaxSequence {
				// Preserve Snowflake's backpressure at capacity rather than rejecting writes.
				continue
			}
			sequence = g.sequence + 1
		}
		g.lastMillis = now
		g.sequence = sequence
		return (now-resourceVersionEpoch)<<resourceVersionTimestampShift | g.node<<resourceVersionSequenceBits | sequence, nil
	}
}

func snowflakeTimestampMillis(rv int64) int64 {
	return (rv >> resourceVersionTimestampShift) + resourceVersionEpoch
}

type resourceVersionOrderingError struct {
	rv        int64
	minimumRV int64
}

func (e *resourceVersionOrderingError) Error() string {
	return fmt.Sprintf("generated resource version %d is not greater than current resource version %d; please retry", e.rv, e.minimumRV)
}

func (k *kvStorageBackend) generateResourceVersionWithRetry(ctx context.Context, minimumRV int64) (int64, error) {
	deadline := time.Now().Add(k.resourceVersionMaxWait)
	var waitStarted time.Time
	var waitReason string
	outcome := "exhausted"
	defer func() {
		if !waitStarted.IsZero() {
			k.metrics.ResourceVersionWaitDuration.WithLabelValues(waitReason, outcome).Observe(time.Since(waitStarted).Seconds())
		}
	}()

	for {
		rv, err := k.generateResourceVersion()
		var reason string
		var wait time.Duration
		if err != nil {
			var failure *resourceVersionGenerationError
			if !errors.As(err, &failure) || failure.reason != resourceVersionClockRegression {
				return 0, err
			}
			reason = resourceVersionClockRegression
			wait = time.Duration(failure.lastMillis-failure.currentMillis) * time.Millisecond
		} else if rv <= minimumRV {
			err = &resourceVersionOrderingError{rv: rv, minimumRV: minimumRV}
			reason = "same_timestamp"
			gap := snowflakeTimestampMillis(minimumRV) - snowflakeTimestampMillis(rv)
			if gap > 0 {
				reason = "clock_behind"
			}
			// The next millisecond is greater regardless of the node and sequence bits.
			wait = time.Duration(gap+1) * time.Millisecond
		} else {
			outcome = "recovered"
			return rv, nil
		}

		if k.resourceVersionMaxWait < 0 {
			return 0, err
		}

		if waitStarted.IsZero() {
			waitStarted = time.Now()
			waitReason = reason
		}
		remaining := time.Until(deadline)
		if remaining <= 0 || wait > remaining {
			return 0, err
		}
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			outcome = "canceled"
			return 0, ctx.Err()
		case <-timer.C:
		}
	}
}
