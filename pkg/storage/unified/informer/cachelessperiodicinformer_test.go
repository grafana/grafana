package informer

import (
	"context"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestCachelessPeriodicInformer_DeliversListedObjects(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		list := func(_ context.Context) ([]runtime.Object, error) {
			return []runtime.Object{obj("a"), obj("b")}, nil
		}

		src := NewCachelessPeriodicInformer("things", time.Hour, list)
		h := &recordingHandler{}
		_, err := src.AddEventHandler(h)
		require.NoError(t, err)

		stop := make(chan struct{})
		defer close(stop)
		go src.Run(stop)

		// Finish the initial list and event delivery before checking the projection.
		synctest.Wait()

		assert.ElementsMatch(t, []string{"a", "b"}, h.addedNames())
	})
}

func TestCachelessPeriodicInformer_ReListsOnJitteredInterval(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		list := func(_ context.Context) ([]runtime.Object, error) {
			calls.Add(1)
			return []runtime.Object{obj("a")}, nil
		}

		src := NewCachelessPeriodicInformer("things", 10*time.Millisecond, list)
		h := &recordingHandler{}
		_, err := src.AddEventHandler(h)
		require.NoError(t, err)

		stop := make(chan struct{})
		defer close(stop)
		go src.Run(stop)

		// Finish the initial list before measuring the recurring interval.
		synctest.Wait()

		require.Equal(t, int32(1), calls.Load())

		// Two maximum jittered intervals guarantee two relists without reaching a third.
		synctest.Sleep(22 * time.Millisecond)

		require.Equal(t, int32(3), calls.Load())
	})
}

func TestCachelessPeriodicInformer_RetriesInitialListUntilItSucceeds(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var fail atomic.Bool
		fail.Store(true)
		list := func(_ context.Context) ([]runtime.Object, error) {
			if fail.Load() {
				return nil, assert.AnError
			}
			return []runtime.Object{obj("a")}, nil
		}

		src := NewCachelessPeriodicInformer("things", time.Hour, list)
		h := &recordingHandler{}
		_, err := src.AddEventHandler(h)
		require.NoError(t, err)

		stop := make(chan struct{})
		defer close(stop)
		go src.Run(stop)

		// Let the initial list fail and enter its retry delay before recovering the source.
		synctest.Wait()

		assert.Empty(t, h.addedNames())

		fail.Store(false)

		// Advance through the retry interval and finish delivery of the recovered list.
		synctest.Sleep(periodicRetryInterval)

		assert.ElementsMatch(t, []string{"a"}, h.addedNames())
	})
}
