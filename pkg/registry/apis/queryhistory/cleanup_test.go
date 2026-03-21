package queryhistory

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestIsExpired(t *testing.T) {
	now := time.Now()

	// Expired: timestamp in the past
	assert.True(t, isExpired(now.Add(-1*time.Hour).Unix()))

	// Not expired: timestamp in the future
	assert.False(t, isExpired(now.Add(1*time.Hour).Unix()))

	// Edge: zero means no TTL (should not be expired)
	assert.False(t, isExpired(0))
}
