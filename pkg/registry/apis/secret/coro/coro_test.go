package coro

import (
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
