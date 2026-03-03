package quotas

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuotaTracker_TryAcquire(t *testing.T) {
	tests := []struct {
		name         string
		currentUsage int64
		limit        int64
		wantResult   bool
	}{
		{
			name:         "unlimited quota always allows",
			currentUsage: 999,
			limit:        0,
			wantResult:   true,
		},
		{
			name:         "within quota allows",
			currentUsage: 5,
			limit:        10,
			wantResult:   true,
		},
		{
			name:         "at limit rejects",
			currentUsage: 10,
			limit:        10,
			wantResult:   false,
		},
		{
			name:         "over limit rejects",
			currentUsage: 15,
			limit:        10,
			wantResult:   false,
		},
		{
			name:         "one below limit allows",
			currentUsage: 9,
			limit:        10,
			wantResult:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tracker := NewInMemoryQuotaTracker(tt.currentUsage, tt.limit)
			got := tracker.TryAcquire()
			assert.Equal(t, tt.wantResult, got)
		})
	}
}

func TestQuotaTracker_TryAcquireIncrementsCounter(t *testing.T) {
	tracker := NewInMemoryQuotaTracker(8, 10)

	require.True(t, tracker.TryAcquire())  // 8 -> 9
	require.True(t, tracker.TryAcquire())  // 9 -> 10
	require.False(t, tracker.TryAcquire()) // 10 >= 10, rejected
	require.False(t, tracker.TryAcquire()) // still at 10, rejected
}

func TestQuotaTracker_Release(t *testing.T) {
	tracker := NewInMemoryQuotaTracker(10, 10)

	// At limit, acquire should fail
	require.False(t, tracker.TryAcquire())

	// Release one slot
	tracker.Release()

	// Now acquire should succeed
	require.True(t, tracker.TryAcquire())

	// And fail again at limit
	require.False(t, tracker.TryAcquire())
}

func TestQuotaTracker_ReleaseUnlimited(t *testing.T) {
	tracker := NewInMemoryQuotaTracker(0, 0)

	// Release on unlimited tracker should not panic
	tracker.Release()
	require.True(t, tracker.TryAcquire())
}

func TestQuotaTracker_ReleaseNeverGoesBelowZero(t *testing.T) {
	tracker := NewInMemoryQuotaTracker(1, 10)

	// Release more times than the current count
	tracker.Release() // 1 -> 0
	tracker.Release() // should stay at 0
	tracker.Release() // should stay at 0

	// Current is 0, so we should be able to acquire exactly 10 times
	for i := 0; i < 10; i++ {
		require.True(t, tracker.TryAcquire(), "acquire %d should succeed", i)
	}
	require.False(t, tracker.TryAcquire(), "acquire at limit should fail")
}

func TestQuotaTracker_ConcurrentAccess(t *testing.T) {
	limit := int64(100)
	tracker := NewInMemoryQuotaTracker(0, limit)

	var wg sync.WaitGroup
	acquired := make(chan bool, 200)

	// Launch 200 goroutines each trying to acquire
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			acquired <- tracker.TryAcquire()
		}()
	}

	wg.Wait()
	close(acquired)

	successCount := 0
	for result := range acquired {
		if result {
			successCount++
		}
	}

	// Exactly 100 should succeed (limit)
	assert.Equal(t, int(limit), successCount)
}

func TestQuotaTracker_ConcurrentAcquireAndRelease(t *testing.T) {
	tracker := NewInMemoryQuotaTracker(50, 50)

	var wg sync.WaitGroup

	// Release 10 slots concurrently
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			tracker.Release()
		}()
	}
	wg.Wait()

	// Now we should be able to acquire exactly 10
	acquired := 0
	for i := 0; i < 20; i++ {
		if tracker.TryAcquire() {
			acquired++
		}
	}
	assert.Equal(t, 10, acquired)
}
