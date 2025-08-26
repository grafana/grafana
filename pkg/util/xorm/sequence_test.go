package xorm

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSequenceGenerator(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	require.NotNil(t, eng)
	require.Equal(t, "sqlite3", eng.DriverName())

	_, err = eng.Exec("CREATE TABLE `autoincrement_sequences` (`name` STRING(128) NOT NULL PRIMARY KEY, `next_value` INT64 NOT NULL)")
	require.NoError(t, err)

	sg := newSequenceGenerator(eng.db.DB)
	val, err := sg.Next(context.Background(), "test", "test")
	require.NoError(t, err)
	require.Equal(t, int64(1), val)

	val, err = sg.Next(context.Background(), "test", "different")
	require.NoError(t, err)
	require.Equal(t, int64(1), val)

	val, err = sg.Next(context.Background(), "test", "different")
	require.NoError(t, err)
	require.Equal(t, int64(2), val)
}

func TestBatchSequenceAllocation(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)

	_, err = eng.Exec("CREATE TABLE `autoincrement_sequences` (`name` STRING(128) NOT NULL PRIMARY KEY, `next_value` INT64 NOT NULL)")
	require.NoError(t, err)

	// Create sequence generator with small batch size for testing
	sg := newSequenceGenerator(eng.db.DB)
	sg.SetBatchSize(10)

	// First batch (1-10)
	for i := 1; i <= 10; i++ {
		val, err := sg.Next(context.Background(), "test", "batch")
		require.NoError(t, err)
		require.Equal(t, int64(i), val)
	}

	// Next value should trigger a new batch (11-20)
	val, err := sg.Next(context.Background(), "test", "batch")
	require.NoError(t, err)
	require.Equal(t, int64(11), val)

	// Check database value is now set to next batch
	var nextVal int64
	err = eng.db.QueryRow("SELECT next_value FROM autoincrement_sequences WHERE name = 'test:batch'").Scan(&nextVal)
	require.NoError(t, err)
	require.Equal(t, int64(21), nextVal, "Database should store the start of the next batch")

	// Continue getting values from the second batch
	for i := 12; i <= 20; i++ {
		val, err := sg.Next(context.Background(), "test", "batch")
		require.NoError(t, err)
		require.Equal(t, int64(i), val)
	}
}

func TestConcurrentSequenceAccess(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)

	_, err = eng.Exec("CREATE TABLE `autoincrement_sequences` (`name` STRING(128) NOT NULL PRIMARY KEY, `next_value` INT64 NOT NULL)")
	require.NoError(t, err)

	sg := newSequenceGenerator(eng.db.DB)
	sg.SetBatchSize(100)

	// Launch multiple goroutines to get sequence values
	const numRoutines = 50
	const valuesPerRoutine = 20
	results := make([]int64, numRoutines*valuesPerRoutine)

	var wg sync.WaitGroup
	var mu sync.Mutex // To protect results slice

	ctx := context.Background()

	for i := 0; i < numRoutines; i++ {
		wg.Add(1)
		go func(routineID int) {
			defer wg.Done()

			for j := 0; j < valuesPerRoutine; j++ {
				val, err := sg.Next(ctx, "test", "concurrent")
				require.NoError(t, err)

				// Store the result in our results array
				mu.Lock()
				results[routineID*valuesPerRoutine+j] = val
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	// Check that we have the expected number of values
	require.Equal(t, numRoutines*valuesPerRoutine, len(results))

	// Create a map to check for duplicates
	seen := make(map[int64]bool)
	for _, val := range results {
		// Verify we haven't seen this value before
		require.False(t, seen[val], "Found duplicate sequence value: %d", val)
		seen[val] = true
	}

	// Verify the range of values is correct (all values should be between 1 and numRoutines*valuesPerRoutine)
	require.Equal(t, numRoutines*valuesPerRoutine, len(seen), "Should have exactly the right number of unique values")
	for i := int64(1); i <= int64(numRoutines*valuesPerRoutine); i++ {
		require.True(t, seen[i], "Missing sequence value: %d", i)
	}
}
