package log

import (
	"fmt"
	"strings"
	"sync"
	"testing"

	gokitlog "github.com/go-kit/log"
	"github.com/stretchr/testify/require"
)

func resetRootCapture(t *testing.T) {
	t.Helper()
	require.Zero(t, rootCapture.active.Load())
	rootCapture.mu.Lock()
	rootCapture.clearLocked()
	rootCapture.nextSeq = 0
	rootCapture.mu.Unlock()
	t.Cleanup(func() {
		require.Zero(t, rootCapture.active.Load())
		rootCapture.mu.Lock()
		rootCapture.clearLocked()
		rootCapture.mu.Unlock()
	})
}

func TestCaptureIdleSinkStoresNothing(t *testing.T) {
	resetRootCapture(t)

	require.NoError(t, newCaptureLogger().Log("msg", "idle"))
	require.Empty(t, rootCapture.entries)
}

func TestCaptureWindowAndIdempotentStop(t *testing.T) {
	resetRootCapture(t)
	logger := newCaptureLogger()

	require.NoError(t, logger.Log("msg", "before"))
	capture := StartCapture()
	require.NoError(t, logger.Log("msg", "inside"))
	lines := capture.Stop()
	require.Equal(t, []string{"msg=inside"}, lines)

	require.NoError(t, logger.Log("msg", "after"))
	require.Nil(t, capture.Stop())
	require.Empty(t, rootCapture.entries)
}

func TestOverlappingCapturesHaveIndependentWindows(t *testing.T) {
	resetRootCapture(t)
	logger := newCaptureLogger()

	first := StartCapture()
	require.NoError(t, logger.Log("msg", "first-only"))
	second := StartCapture()
	require.NoError(t, logger.Log("msg", "shared"))

	require.Equal(t, []string{"msg=first-only", "msg=shared"}, first.Stop())
	require.NotEmpty(t, rootCapture.entries, "the ring remains live for the second capture")
	require.NoError(t, logger.Log("msg", "second-only"))
	require.Equal(t, []string{"msg=shared", "msg=second-only"}, second.Stop())
	require.Empty(t, rootCapture.entries, "the last stop clears retained log data")
}

func TestCaptureRingEvictsByEntryAndByteCaps(t *testing.T) {
	t.Run("entries", func(t *testing.T) {
		ring := &captureRing{}
		ring.active.Store(1)
		for i := 0; i <= captureRingMaxEntries; i++ {
			_, err := ring.Write([]byte(fmt.Sprintf("line-%d", i)))
			require.NoError(t, err)
		}
		require.Len(t, ring.entries, captureRingMaxEntries)
		require.Equal(t, "line-1", ring.entries[0].line)
	})

	t.Run("bytes", func(t *testing.T) {
		ring := &captureRing{}
		ring.active.Store(1)
		line := []byte(strings.Repeat("x", captureLineMaxBytes))
		for ring.nextSeq < captureRingMaxBytes/captureLineMaxBytes+1 {
			_, err := ring.Write(line)
			require.NoError(t, err)
		}
		require.LessOrEqual(t, ring.totalBytes, captureRingMaxBytes)
		require.Equal(t, captureRingMaxBytes/captureLineMaxBytes, len(ring.entries))
	})
}

func TestCaptureRingTruncatesLongLines(t *testing.T) {
	ring := &captureRing{}
	ring.active.Store(1)

	input := []byte(strings.Repeat("x", captureLineMaxBytes+100) + "\n")
	written, err := ring.Write(input)
	require.NoError(t, err)
	require.Equal(t, len(input), written)
	require.Len(t, ring.entries[0].line, captureLineMaxBytes)
	require.True(t, strings.HasSuffix(ring.entries[0].line, captureTruncatedMark))
}

func TestCaptureParallelWritersAndOverlappingCaptures(t *testing.T) {
	resetRootCapture(t)
	logger := newCaptureLogger()
	first := StartCapture()
	second := StartCapture()

	var wg sync.WaitGroup
	for worker := 0; worker < 8; worker++ {
		wg.Add(1)
		go func(worker int) {
			defer wg.Done()
			for i := 0; i < 100; i++ {
				require.NoError(t, logger.Log("worker", worker, "line", i))
			}
		}(worker)
	}
	wg.Wait()

	require.Len(t, first.Stop(), 800)
	require.Len(t, second.Stop(), 800)
}

func TestRepeatedInitializeAddsOneCaptureSink(t *testing.T) {
	resetRootCapture(t)
	manager := newManager(gokitlog.NewNopLogger())
	logger := manager.New("capture-test")

	manager.initialize(nil, "info")
	capture := StartCapture()
	logger.Debug("first")
	manager.initialize(nil, "info")
	logger.Debug("second")

	require.Len(t, capture.Stop(), 2)
}
