package membercache

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/team"
)

func TestCache_GetSet(t *testing.T) {
	ctx := context.Background()
	tracer := tracing.InitializeTracerForTest()
	cache := NewCache(100, 5*time.Minute, tracer)

	// Test cache miss
	_, found := cache.Get(ctx, 1, 1, 1)
	assert.False(t, found, "Expected cache miss")

	// Test cache set and hit
	cache.Set(ctx, 1, 1, 1, team.PermissionTypeMember)
	perm, found := cache.Get(ctx, 1, 1, 1)
	assert.True(t, found, "Expected cache hit")
	assert.Equal(t, team.PermissionTypeMember, perm)

	// Test different permission type
	cache.Set(ctx, 1, 2, 1, team.PermissionTypeAdmin)
	perm, found = cache.Get(ctx, 1, 2, 1)
	assert.True(t, found, "Expected cache hit")
	assert.Equal(t, team.PermissionTypeAdmin, perm)
}

func TestCache_MultipleEntries(t *testing.T) {
	ctx := context.Background()
	tracer := tracing.InitializeTracerForTest()
	cache := NewCache(100, 5*time.Minute, tracer)

	// Add multiple entries for different users/teams
	cache.Set(ctx, 1, 1, 1, team.PermissionTypeMember)
	cache.Set(ctx, 1, 2, 1, team.PermissionTypeAdmin)
	cache.Set(ctx, 1, 3, 2, team.PermissionTypeMember)
	cache.Set(ctx, 2, 1, 1, team.PermissionTypeAdmin)

	assert.Equal(t, 4, cache.Len(), "Expected 4 entries in cache")

	// Verify each entry
	perm, found := cache.Get(ctx, 1, 1, 1)
	assert.True(t, found)
	assert.Equal(t, team.PermissionTypeMember, perm)

	perm, found = cache.Get(ctx, 1, 2, 1)
	assert.True(t, found)
	assert.Equal(t, team.PermissionTypeAdmin, perm)

	perm, found = cache.Get(ctx, 1, 3, 2)
	assert.True(t, found)
	assert.Equal(t, team.PermissionTypeMember, perm)

	perm, found = cache.Get(ctx, 2, 1, 1)
	assert.True(t, found)
	assert.Equal(t, team.PermissionTypeAdmin, perm)
}

func TestCache_ClearUser(t *testing.T) {
	ctx := context.Background()
	tracer := tracing.InitializeTracerForTest()
	cache := NewCache(100, 5*time.Minute, tracer)

	// Add entries for two users
	cache.Set(ctx, 1, 1, 1, team.PermissionTypeMember)
	cache.Set(ctx, 1, 2, 1, team.PermissionTypeAdmin)
	cache.Set(ctx, 1, 3, 1, team.PermissionTypeMember)
	cache.Set(ctx, 1, 1, 2, team.PermissionTypeMember)
	cache.Set(ctx, 1, 2, 2, team.PermissionTypeAdmin)

	assert.Equal(t, 5, cache.Len())

	// Clear user 1
	cache.ClearUser(ctx, 1)

	// User 1's entries should be gone
	_, found := cache.Get(ctx, 1, 1, 1)
	assert.False(t, found)
	_, found = cache.Get(ctx, 1, 2, 1)
	assert.False(t, found)
	_, found = cache.Get(ctx, 1, 3, 1)
	assert.False(t, found)

	// User 2's entries should remain
	perm, found := cache.Get(ctx, 1, 1, 2)
	assert.True(t, found)
	assert.Equal(t, team.PermissionTypeMember, perm)

	perm, found = cache.Get(ctx, 1, 2, 2)
	assert.True(t, found)
	assert.Equal(t, team.PermissionTypeAdmin, perm)
}

func TestCache_ClearAll(t *testing.T) {
	ctx := context.Background()
	tracer := tracing.InitializeTracerForTest()
	cache := NewCache(100, 5*time.Minute, tracer)

	// Add multiple entries
	cache.Set(ctx, 1, 1, 1, team.PermissionTypeMember)
	cache.Set(ctx, 1, 2, 1, team.PermissionTypeAdmin)
	cache.Set(ctx, 1, 3, 2, team.PermissionTypeMember)

	assert.Equal(t, 3, cache.Len())

	// Clear all
	cache.ClearAll(ctx)

	assert.Equal(t, 0, cache.Len())

	// Verify all entries are gone
	_, found := cache.Get(ctx, 1, 1, 1)
	assert.False(t, found)
	_, found = cache.Get(ctx, 1, 2, 1)
	assert.False(t, found)
	_, found = cache.Get(ctx, 1, 3, 2)
	assert.False(t, found)
}

func TestCache_LRUEviction(t *testing.T) {
	ctx := context.Background()
	tracer := tracing.InitializeTracerForTest()

	// Create a cache with only 3 entries
	cache := NewCache(3, 5*time.Minute, tracer)

	// Add 3 entries
	cache.Set(ctx, 1, 1, 1, team.PermissionTypeMember)
	cache.Set(ctx, 1, 2, 1, team.PermissionTypeAdmin)
	cache.Set(ctx, 1, 3, 1, team.PermissionTypeMember)

	assert.Equal(t, 3, cache.Len())

	// Add a 4th entry - should evict the oldest
	cache.Set(ctx, 1, 4, 1, team.PermissionTypeAdmin)

	assert.Equal(t, 3, cache.Len(), "Cache should maintain max size")

	// The 4th entry should be present
	perm, found := cache.Get(ctx, 1, 4, 1)
	assert.True(t, found)
	assert.Equal(t, team.PermissionTypeAdmin, perm)
}

func TestCache_TTLExpiration(t *testing.T) {
	ctx := context.Background()
	tracer := tracing.InitializeTracerForTest()

	// Create a cache with very short TTL
	cache := NewCache(100, 100*time.Millisecond, tracer)

	// Add an entry
	cache.Set(ctx, 1, 1, 1, team.PermissionTypeMember)

	// Should be found immediately
	perm, found := cache.Get(ctx, 1, 1, 1)
	require.True(t, found)
	assert.Equal(t, team.PermissionTypeMember, perm)

	// Wait for TTL to expire
	time.Sleep(150 * time.Millisecond)

	// Should not be found after TTL
	_, found = cache.Get(ctx, 1, 1, 1)
	assert.False(t, found, "Entry should have expired")
}

func TestCache_OverwriteEntry(t *testing.T) {
	ctx := context.Background()
	tracer := tracing.InitializeTracerForTest()
	cache := NewCache(100, 5*time.Minute, tracer)

	// Set initial permission
	cache.Set(ctx, 1, 1, 1, team.PermissionTypeMember)
	perm, found := cache.Get(ctx, 1, 1, 1)
	require.True(t, found)
	assert.Equal(t, team.PermissionTypeMember, perm)

	// Overwrite with different permission
	cache.Set(ctx, 1, 1, 1, team.PermissionTypeAdmin)
	perm, found = cache.Get(ctx, 1, 1, 1)
	require.True(t, found)
	assert.Equal(t, team.PermissionTypeAdmin, perm)
}

func TestNoOpCache(t *testing.T) {
	ctx := context.Background()
	cache := &NoOpCache{}

	// Get should always return false
	_, found := cache.Get(ctx, 1, 1, 1)
	assert.False(t, found)

	// Set should not panic
	cache.Set(ctx, 1, 1, 1, team.PermissionTypeMember)

	// Still should not find anything
	_, found = cache.Get(ctx, 1, 1, 1)
	assert.False(t, found)

	// ClearUser and ClearAll should not panic
	cache.ClearUser(ctx, 1)
	cache.ClearAll(ctx)

	// Len should always return 0
	assert.Equal(t, 0, cache.Len())
}

func TestCache_ConcurrentAccess(t *testing.T) {
	ctx := context.Background()
	tracer := tracing.InitializeTracerForTest()
	cache := NewCache(1000, 5*time.Minute, tracer)

	// Run concurrent operations
	done := make(chan bool, 100)

	for i := 0; i < 100; i++ {
		go func(idx int) {
			// Each goroutine does some cache operations
			userID := int64(idx % 10)
			teamID := int64(idx % 20)
			orgID := int64(1)

			cache.Set(ctx, orgID, teamID, userID, team.PermissionTypeMember)
			cache.Get(ctx, orgID, teamID, userID)

			if idx%10 == 0 {
				cache.ClearUser(ctx, userID)
			}

			done <- true
		}(i)
	}

	// Wait for all goroutines to complete
	for i := 0; i < 100; i++ {
		<-done
	}

	// Cache should still be functional
	cache.Set(ctx, 1, 1, 1, team.PermissionTypeAdmin)
	perm, found := cache.Get(ctx, 1, 1, 1)
	assert.True(t, found)
	assert.Equal(t, team.PermissionTypeAdmin, perm)
}
