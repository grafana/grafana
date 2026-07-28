package controller

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

func newRetryTestController(processFn func(string) error) *RepositoryController {
	rc := &RepositoryController{
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[string](),
			workqueue.TypedRateLimitingQueueConfig[string]{Name: "test-retry"},
		),
		logger: logging.DefaultLogger.With("logger", "test"),
	}
	rc.processFn = processFn
	return rc
}

// A stale read is transient — the write behind the event is committed, the read
// path just has not caught up — so the worker requeues the key instead of
// dropping the event until the next re-list.
func TestProcessNextWorkItem_RetriesStaleReads(t *testing.T) {
	var calls int
	rc := newRetryTestController(func(string) error {
		calls++
		if calls < maxAttempts {
			return fmt.Errorf("get repository: %w", informer.ErrStaleRead)
		}
		return nil
	})
	rc.queue.Add("ns/r")

	for calls < maxAttempts {
		require.True(t, rc.processNextWorkItem(context.Background()))
	}
	assert.Equal(t, maxAttempts, calls)
	assert.Zero(t, rc.queue.Len(), "a succeeded key must not be requeued")
}

// Retrying is bounded: a read that never catches up is dropped at maxAttempts,
// leaving recovery to the periodic re-list.
func TestProcessNextWorkItem_DropsStaleReadAfterMaxAttempts(t *testing.T) {
	var calls int
	rc := newRetryTestController(func(string) error {
		calls++
		return fmt.Errorf("get repository: %w", informer.ErrStaleRead)
	})
	rc.queue.Add("ns/r")

	for i := 0; i < maxAttempts; i++ {
		require.True(t, rc.processNextWorkItem(context.Background()))
	}
	assert.Equal(t, maxAttempts, calls)
	assert.Zero(t, rc.queue.Len(), "an exhausted key must be dropped, not requeued")
}

// Other errors keep today's behavior: no retry.
func TestProcessNextWorkItem_DoesNotRetryOtherErrors(t *testing.T) {
	var calls int
	rc := newRetryTestController(func(string) error {
		calls++
		return errors.New("boom")
	})
	rc.queue.Add("ns/r")

	require.True(t, rc.processNextWorkItem(context.Background()))
	assert.Equal(t, 1, calls)
	assert.Zero(t, rc.queue.Len())
}
