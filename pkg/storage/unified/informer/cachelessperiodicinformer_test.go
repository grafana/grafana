package informer

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestCachelessPeriodicInformer_DeliversListedObjects(t *testing.T) {
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

	require.Eventually(t, func() bool { return len(h.addedNames()) == 2 }, time.Second, 5*time.Millisecond)
	assert.ElementsMatch(t, []string{"a", "b"}, h.addedNames())
}

func TestCachelessPeriodicInformer_ReListsOnJitteredInterval(t *testing.T) {
	var mu sync.Mutex
	calls := 0
	list := func(_ context.Context) ([]runtime.Object, error) {
		mu.Lock()
		calls++
		mu.Unlock()
		return []runtime.Object{obj("a")}, nil
	}

	src := NewCachelessPeriodicInformer("things", 10*time.Millisecond, list)
	// Pin jitter to 0 so the interval is deterministic and the test is not flaky;
	// the jittered path is still exercised via wait.Jitter with a zero factor.
	src.jitterFactor = 0
	h := &recordingHandler{}
	_, err := src.AddEventHandler(h)
	require.NoError(t, err)

	stop := make(chan struct{})
	defer close(stop)
	go src.Run(stop)

	// The initial list plus at least two more re-lists means the recurring timer fired.
	require.Eventually(t, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return calls >= 3
	}, time.Second, 5*time.Millisecond)
}

func TestCachelessPeriodicInformer_RetriesInitialListUntilItSucceeds(t *testing.T) {
	var mu sync.Mutex
	fail := true
	list := func(_ context.Context) ([]runtime.Object, error) {
		mu.Lock()
		defer mu.Unlock()
		if fail {
			return nil, assert.AnError
		}
		return []runtime.Object{obj("a")}, nil
	}

	src := NewCachelessPeriodicInformer("things", time.Hour, list)
	// Shorten the retry so the test does not wait the default interval.
	src.retryInterval = 10 * time.Millisecond
	h := &recordingHandler{}
	_, err := src.AddEventHandler(h)
	require.NoError(t, err)

	stop := make(chan struct{})
	defer close(stop)
	go src.Run(stop)

	// Nothing delivered while the list keeps failing.
	assert.Empty(t, h.addedNames())

	mu.Lock()
	fail = false
	mu.Unlock()

	require.Eventually(t, func() bool { return len(h.addedNames()) == 1 }, time.Second, 5*time.Millisecond)
	assert.ElementsMatch(t, []string{"a"}, h.addedNames())
}
