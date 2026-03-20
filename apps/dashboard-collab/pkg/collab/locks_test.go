package collab

import (
	"fmt"
	"sort"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAcquireLock(t *testing.T) {
	lt := NewLockTable()

	granted, holder := lt.Acquire("panel-1", "alice")
	require.True(t, granted)
	require.Equal(t, "alice", holder)
}

func TestAcquireLockDenied(t *testing.T) {
	lt := NewLockTable()

	lt.Acquire("panel-1", "alice")
	granted, holder := lt.Acquire("panel-1", "bob")
	require.False(t, granted)
	require.Equal(t, "alice", holder)
}

func TestAcquireLockIdempotent(t *testing.T) {
	lt := NewLockTable()

	lt.Acquire("panel-1", "alice")
	granted, holder := lt.Acquire("panel-1", "alice")
	require.True(t, granted)
	require.Equal(t, "alice", holder)
}

func TestReleaseLock(t *testing.T) {
	lt := NewLockTable()

	lt.Acquire("panel-1", "alice")
	released := lt.Release("panel-1", "alice")
	require.True(t, released)

	// Panel is now free — another user can acquire it
	granted, holder := lt.Acquire("panel-1", "bob")
	require.True(t, granted)
	require.Equal(t, "bob", holder)
}

func TestReleaseLockNotHeld(t *testing.T) {
	lt := NewLockTable()

	released := lt.Release("panel-1", "alice")
	require.False(t, released)
}

func TestReleaseLockWrongUser(t *testing.T) {
	lt := NewLockTable()

	lt.Acquire("panel-1", "alice")
	released := lt.Release("panel-1", "bob")
	require.False(t, released)

	// Alice still holds the lock
	snap := lt.Snapshot()
	require.Equal(t, "alice", snap["panel-1"])
}

func TestReleaseAll(t *testing.T) {
	lt := NewLockTable()

	lt.Acquire("panel-1", "alice")
	lt.Acquire("panel-2", "alice")
	lt.Acquire("panel-3", "bob")

	released := lt.ReleaseAll("alice")
	sort.Strings(released)
	require.Equal(t, []string{"panel-1", "panel-2"}, released)

	// Bob's lock is untouched
	snap := lt.Snapshot()
	require.Len(t, snap, 1)
	require.Equal(t, "bob", snap["panel-3"])
}

func TestReleaseAllNoLocks(t *testing.T) {
	lt := NewLockTable()

	released := lt.ReleaseAll("alice")
	require.Empty(t, released)
}

func TestMultipleLocksPerUser(t *testing.T) {
	lt := NewLockTable()

	granted1, _ := lt.Acquire("panel-1", "alice")
	granted2, _ := lt.Acquire("panel-2", "alice")
	granted3, _ := lt.Acquire("__dashboard__", "alice")
	require.True(t, granted1)
	require.True(t, granted2)
	require.True(t, granted3)

	snap := lt.Snapshot()
	require.Len(t, snap, 3)
}

func TestSnapshot(t *testing.T) {
	lt := NewLockTable()

	lt.Acquire("panel-1", "alice")
	lt.Acquire("panel-2", "bob")

	snap := lt.Snapshot()
	require.Equal(t, map[string]string{
		"panel-1": "alice",
		"panel-2": "bob",
	}, snap)

	// Snapshot is a copy — modifying it doesn't affect the lock table
	snap["panel-3"] = "charlie"
	require.Len(t, lt.Snapshot(), 2)
}

func TestConcurrentLockContention(t *testing.T) {
	lt := NewLockTable()
	const numGoroutines = 20
	const target = "panel-1"

	var wg sync.WaitGroup
	winners := make(chan string, numGoroutines)

	for i := range numGoroutines {
		wg.Add(1)
		go func(userId string) {
			defer wg.Done()
			granted, _ := lt.Acquire(target, userId)
			if granted {
				winners <- userId
			}
		}(fmt.Sprintf("user-%d", i))
	}

	wg.Wait()
	close(winners)

	// Exactly one user should have won the lock initially.
	// The winner may appear multiple times if they got the idempotent path,
	// but only one distinct userId should have been granted.
	winnerSet := make(map[string]bool)
	for w := range winners {
		winnerSet[w] = true
	}
	require.Len(t, winnerSet, 1, "exactly one user should win the lock")

	// The lock table should have exactly one lock
	snap := lt.Snapshot()
	require.Len(t, snap, 1)
}

func TestConcurrentAcquireRelease(t *testing.T) {
	lt := NewLockTable()
	const iterations = 100
	var wg sync.WaitGroup

	// Two users racing to acquire and release the same panel
	for _, userId := range []string{"alice", "bob"} {
		wg.Add(1)
		go func(uid string) {
			defer wg.Done()
			for range iterations {
				lt.Acquire("panel-1", uid)
				lt.Release("panel-1", uid)
			}
		}(userId)
	}

	wg.Wait()

	// After all operations, the panel should be unlocked
	// (both users released their locks)
	snap := lt.Snapshot()
	require.Empty(t, snap)
}
