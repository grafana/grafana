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
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

func newRetryTestController(processFn func(key string) (repoType string, err error)) *RepositoryController {
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

// A stale read is transient: the write behind the notification is committed and
// the read path has not caught up, so the worker re-queues the key instead of
// dropping the event until the next re-list.
func TestProcessNextWorkItem_RetriesStaleReads(t *testing.T) {
	var calls int
	rc := newRetryTestController(func(string) (string, error) {
		calls++
		if calls < maxAttempts {
			return "", fmt.Errorf("get repository: %w", informer.ErrStaleRead)
		}
		return "", nil
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
	rc := newRetryTestController(func(string) (string, error) {
		calls++
		return "", fmt.Errorf("get repository: %w", informer.ErrStaleRead)
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
	rc := newRetryTestController(func(string) (string, error) {
		calls++
		return "", errors.New("boom")
	})
	rc.queue.Add("ns/r")

	require.True(t, rc.processNextWorkItem(context.Background()))
	assert.Equal(t, 1, calls)
	assert.Zero(t, rc.queue.Len())
}

func newConnectionRetryTestController(processFn func(ctx context.Context, key string) error) *ConnectionController {
	cc := &ConnectionController{
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[string](),
			workqueue.TypedRateLimitingQueueConfig[string]{Name: "test-connection-retry"},
		),
		logger:    logging.DefaultLogger.With("logger", "test"),
		processed: usinformer.NewProcessedMetrics(nil, "connections", true),
		triggers:  make(map[string]usinformer.ProcessTrigger),
	}
	cc.processFn = processFn
	return cc
}

// The connection controller classifies stale reads as retryable, mirroring the
// repository controller: the write behind the event is committed, so requeueing
// beats dropping the event until the next re-list.
func TestConnectionProcessNextWorkItem_RetriesStaleReads(t *testing.T) {
	var calls int
	cc := newConnectionRetryTestController(func(context.Context, string) error {
		calls++
		if calls < connectionMaxAttempts {
			return fmt.Errorf("get connection: %w", informer.ErrStaleRead)
		}
		return nil
	})
	cc.queue.Add("ns/c")

	for calls < connectionMaxAttempts {
		require.True(t, cc.processNextWorkItem(context.Background()))
	}
	assert.Equal(t, connectionMaxAttempts, calls)
	assert.Zero(t, cc.queue.Len(), "a succeeded item must not be requeued")
}

// Non-transient connection errors are still dropped without retrying.
func TestConnectionProcessNextWorkItem_DoesNotRetryOtherErrors(t *testing.T) {
	var calls int
	cc := newConnectionRetryTestController(func(context.Context, string) error {
		calls++
		return errors.New("boom")
	})
	cc.queue.Add("ns/c")

	require.True(t, cc.processNextWorkItem(context.Background()))
	assert.Equal(t, 1, calls)
	assert.Zero(t, cc.queue.Len())
}
