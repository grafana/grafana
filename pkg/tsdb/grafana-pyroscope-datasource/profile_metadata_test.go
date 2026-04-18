package pyroscope

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProfileMetadataRegistry(t *testing.T) {
	registry := GetProfileMetadataRegistry()

	t.Run("CPU profile is cumulative", func(t *testing.T) {
		result := registry.IsCumulativeProfile("process_cpu:cpu:nanoseconds:cpu:nanoseconds")
		require.True(t, result)
	})

	t.Run("Memory allocation is cumulative", func(t *testing.T) {
		result := registry.IsCumulativeProfile("memory:alloc_space:bytes:space:bytes")
		require.True(t, result)
	})

	t.Run("Goroutines are instant", func(t *testing.T) {
		result := registry.IsCumulativeProfile("goroutine:goroutine:count:goroutine:count")
		require.False(t, result)
	})

	t.Run("Memory in-use is instant", func(t *testing.T) {
		result := registry.IsCumulativeProfile("memory:inuse_space:bytes:space:bytes")
		require.False(t, result)
	})

	t.Run("Edge case: mutex contentions count is cumulative", func(t *testing.T) {
		result := registry.IsCumulativeProfile("mutex:contentions:count:contentions:count")
		require.True(t, result)
	})

	t.Run("Edge case: memory alloc objects count is cumulative", func(t *testing.T) {
		result := registry.IsCumulativeProfile("memory:alloc_objects:count:space:bytes")
		require.True(t, result)
	})

	t.Run("Unknown profile falls back to unit-based logic", func(t *testing.T) {
		result := registry.IsCumulativeProfile("unknown:profile:nanoseconds:test:test")
		require.True(t, result) // ns should be treated as cumulative by fallback

		result = registry.IsCumulativeProfile("unknown:profile:count:test:test")
		require.False(t, result) // count/short should be treated as instant by fallback
	})
}
