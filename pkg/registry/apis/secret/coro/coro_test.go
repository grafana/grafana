package coro

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBasic(t *testing.T) {
	runtime := NewRuntime()

	counter := 0

	// Spawn coroutines
	for range 100 {
		_ = runtime.Spawn(func() {
			require.Nil(t, Yield())
			counter += 1
			require.Nil(t, Yield())
		})
	}

	// Wait until all of them complete
	for runtime.HasCoroutinesReady() {
		ready := runtime.ReadySet[0]
		runtime.ReadySet = runtime.ReadySet[1:]
		_ = ready.Coroutine.Resume(ready.Payload)
	}

	require.Equal(t, 100, counter)
}

func TestResumeRemoveCoroutineFromReadySet(t *testing.T) {
	runtime := NewRuntime()

	c1 := runtime.Spawn(func() {})
	_ = c1

	// c1 is ready to resume
	require.Equal(t, 1, len(runtime.ReadySet))
	require.Equal(t, c1, runtime.ReadySet[0].Coroutine)
	fmt.Printf("\n\naaaaaaa runtime.ReadySet %+v\n\n", runtime.ReadySet)

	// Resume returns true when the coroutine has no more steps to execute
	require.True(t, c1.Resume(nil))

	// c1 is not in the ready set anymore after being resumed
	require.Empty(t, runtime.ReadySet)
}
