package search

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestSnapshotLockHeartbeat(t *testing.T) {
	tests := []struct {
		name string
		ttl  time.Duration
	}{
		{name: "default TTL", ttl: DefaultSnapshotLockTTL},
		{name: "one second", ttl: time.Second},
		{name: "five seconds", ttl: 5 * time.Second},
		{name: "non-divisible", ttl: 1300 * time.Millisecond},
		{name: "tiny positive", ttl: 1 * time.Nanosecond},
		{name: "zero", ttl: 0},
		{name: "negative", ttl: -1 * time.Second},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			hb := snapshotLockHeartbeat(tc.ttl)

			assert.Greater(t, hb, time.Duration(0), "heartbeat must always be positive")

			if tc.ttl >= 2*time.Second {
				assert.LessOrEqual(t, 2*hb, tc.ttl, "heartbeat must satisfy lock validation (TTL >= 2x heartbeat)")
			}
		})
	}
}
