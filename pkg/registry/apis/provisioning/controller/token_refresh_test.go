package controller

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func Test_shouldRefreshBeforeExpiration(t *testing.T) {
	tests := []struct {
		name           string
		resyncInterval time.Duration
		expiration     time.Time
		want           bool
	}{
		{
			name:           "should refresh when expiration is before buffer (5 minute interval)",
			resyncInterval: 5 * time.Minute,
			expiration:     time.Now().Add(9 * time.Minute), // Less than 2*5m + 10s (10m10s)
			want:           true,
		},
		{
			name:           "should not refresh when expiration is after buffer (5 minute interval)",
			resyncInterval: 5 * time.Minute,
			expiration:     time.Now().Add(11 * time.Minute), // More than 2*5m + 10s (10m10s)
			want:           false,
		},
		{
			name:           "should refresh when expiration is before buffer (60 second interval)",
			resyncInterval: 60 * time.Second,
			expiration:     time.Now().Add(2 * time.Minute), // Less than 2*60s + 10s (130s)
			want:           true,
		},
		{
			name:           "should not refresh when expiration is after buffer (60 second interval)",
			resyncInterval: 60 * time.Second,
			expiration:     time.Now().Add(3 * time.Minute), // More than 2*60s + 10s (130s)
			want:           false,
		},
		{
			name:           "should not refresh when expiration is just after buffer boundary",
			resyncInterval: 5 * time.Minute,
			expiration:     time.Now().Add((2 * 5 * time.Minute) + (10 * time.Second) + (1 * time.Second)),
			want:           false, // Just after the threshold
		},
		{
			name:           "should refresh when token already expired",
			resyncInterval: 5 * time.Minute,
			expiration:     time.Now().Add(-1 * time.Minute), // Already expired
			want:           true,
		},
		{
			name:           "should refresh with very short resync interval",
			resyncInterval: 10 * time.Second,
			expiration:     time.Now().Add(25 * time.Second), // Less than 2*10s + 10s (30s)
			want:           true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := shouldRefreshBeforeExpiration(tt.expiration, tt.resyncInterval)
			assert.Equal(t, tt.want, got)
		})
	}
}

func Test_shouldRefreshBeforeExpiration_bufferCalculation(t *testing.T) {
	// Test that the buffer is correctly calculated as 2 * resyncInterval + 10 seconds

	t.Run("5 minute interval results in 10m10s buffer", func(t *testing.T) {
		resyncInterval := 5 * time.Minute
		expectedBuffer := (2 * resyncInterval) + (tokenRefreshBufferSeconds * time.Second)

		// Token expiring just before the buffer should trigger refresh
		expiration := time.Now().Add(expectedBuffer - time.Second)
		assert.True(t, shouldRefreshBeforeExpiration(expiration, resyncInterval))

		// Token expiring just after the buffer should not trigger refresh
		expiration = time.Now().Add(expectedBuffer + time.Second)
		assert.False(t, shouldRefreshBeforeExpiration(expiration, resyncInterval))
	})

	t.Run("1 minute interval results in 2m10s buffer", func(t *testing.T) {
		resyncInterval := 1 * time.Minute
		expectedBuffer := (2 * resyncInterval) + (tokenRefreshBufferSeconds * time.Second)

		// Token expiring just before the buffer should trigger refresh
		expiration := time.Now().Add(expectedBuffer - time.Second)
		assert.True(t, shouldRefreshBeforeExpiration(expiration, resyncInterval))

		// Token expiring just after the buffer should not trigger refresh
		expiration = time.Now().Add(expectedBuffer + time.Second)
		assert.False(t, shouldRefreshBeforeExpiration(expiration, resyncInterval))
	})
}
