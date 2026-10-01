package resource

import (
	"crypto/rand"
	"encoding/binary"
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
	elapsed    func(time.Time, time.Time) time.Duration
	baseline   time.Time
	node       int64
	lastMillis int64
	sequence   int64
}

func newResourceVersionGenerator(node int64, now func() time.Time) *snowflakeResourceVersionGenerator {
	return &snowflakeResourceVersionGenerator{node: node, now: now, elapsed: time.Time.Sub, baseline: now()}
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
		current := g.now()
		baseline := g.baseline
		monotonicElapsed := g.elapsed(current, baseline)
		wallElapsed := current.Round(0).Sub(baseline.Round(0))
		if monotonicElapsed < wallElapsed {
			// Suspension can leave monotonic time behind wall time. Rebase forward
			// to recover, while retaining monotonic progress after backward corrections.
			baseline = current
			monotonicElapsed = 0
		}
		now := baseline.Add(monotonicElapsed).UnixMilli()
		if now < resourceVersionEpoch || now > resourceVersionEpoch+resourceVersionMaxTimestamp {
			return 0, &resourceVersionGenerationError{reason: resourceVersionTimestampOutOfRange, currentMillis: now, lastMillis: g.lastMillis}
		}
		sequence := int64(0)
		if now == g.lastMillis {
			if g.sequence == resourceVersionMaxSequence {
				// Preserve Snowflake's backpressure at capacity rather than rejecting writes.
				continue
			}
			sequence = g.sequence + 1
		}
		g.baseline = baseline
		g.lastMillis = now
		g.sequence = sequence
		return (now-resourceVersionEpoch)<<resourceVersionTimestampShift | g.node<<resourceVersionSequenceBits | sequence, nil
	}
}

func snowflakeTimestampMillis(rv int64) int64 {
	return (rv >> resourceVersionTimestampShift) + resourceVersionEpoch
}
