package resources

import (
	"context"
	"errors"
	"fmt"
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestIsTransientError(t *testing.T) {
	tests := []struct {
		name        string
		err         error
		isTransient bool
	}{
		{
			name:        "nil error",
			err:         nil,
			isTransient: false,
		},
		{
			name:        "ServiceUnavailable (503)",
			err:         apierrors.NewServiceUnavailable("service unavailable"),
			isTransient: true,
		},
		{
			name:        "ServerTimeout (504)",
			err:         apierrors.NewServerTimeout(schema.GroupResource{}, "get", 1),
			isTransient: true,
		},
		{
			name:        "TooManyRequests (429)",
			err:         apierrors.NewTooManyRequests("too many requests", 1),
			isTransient: true,
		},
		{
			name:        "InternalError (500)",
			err:         apierrors.NewInternalError(errors.New("internal error")),
			isTransient: true,
		},
		{
			name:        "Timeout",
			err:         apierrors.NewTimeoutError("timeout", 1),
			isTransient: true,
		},
		{
			name:        "network timeout error",
			err:         &netTimeoutError{msg: "network timeout"},
			isTransient: true,
		},
		{
			name:        "network operation error",
			err:         &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("connection refused")},
			isTransient: true,
		},
		{
			name:        "NotFound (404) - not transient",
			err:         apierrors.NewNotFound(schema.GroupResource{}, "resource"),
			isTransient: false,
		},
		{
			name:        "BadRequest (400) - not transient",
			err:         apierrors.NewBadRequest("bad request"),
			isTransient: false,
		},
		{
			name:        "Forbidden (403) - not transient",
			err:         apierrors.NewForbidden(schema.GroupResource{}, "resource", errors.New("forbidden")),
			isTransient: false,
		},
		{
			name:        "Unauthorized (401) - not transient",
			err:         apierrors.NewUnauthorized("unauthorized"),
			isTransient: false,
		},
		{
			name:        "Conflict (409) - not transient",
			err:         apierrors.NewConflict(schema.GroupResource{}, "resource", errors.New("conflict")),
			isTransient: false,
		},
		{
			name:        "AlreadyExists (409) - not transient",
			err:         apierrors.NewAlreadyExists(schema.GroupResource{}, "resource"),
			isTransient: false,
		},
		{
			name:        "managed by repository error - not transient",
			err:         errors.New("this resource is managed by a repository"),
			isTransient: false,
		},
		{
			name:        "wrapped managed by repository error - not transient",
			err:         fmt.Errorf("unable to create resource: %w", errors.New("this resource is managed by a repository")),
			isTransient: false,
		},
		{
			name:        "generic error - not transient",
			err:         errors.New("some random error"),
			isTransient: false,
		},
		{
			name:        "context canceled - not transient",
			err:         context.Canceled,
			isTransient: false,
		},
		{
			name:        "context deadline exceeded - not transient",
			err:         context.DeadlineExceeded,
			isTransient: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isTransientError(tt.err)
			assert.Equal(t, tt.isTransient, result, "expected isTransientError(%v) = %v, got %v", tt.err, tt.isTransient, result)
		})
	}
}

func TestIsTransientError_WrappedErrors(t *testing.T) {
	t.Run("wrapped ServiceUnavailable", func(t *testing.T) {
		err := fmt.Errorf("operation failed: %w", apierrors.NewServiceUnavailable("service unavailable"))
		assert.True(t, isTransientError(err))
	})

	t.Run("wrapped network timeout", func(t *testing.T) {
		err := fmt.Errorf("network operation failed: %w", &netTimeoutError{msg: "timeout"})
		assert.True(t, isTransientError(err))
	})

	t.Run("wrapped NotFound - not transient", func(t *testing.T) {
		err := fmt.Errorf("operation failed: %w", apierrors.NewNotFound(schema.GroupResource{}, "resource"))
		assert.False(t, isTransientError(err))
	})
}

func TestRetryWithBackoff_NonTransientError(t *testing.T) {
	ri := &retryResourceInterface{
		backoff: defaultRetryBackoff(),
	}

	attemptCount := 0
	err := ri.retryWithBackoff(context.Background(), func() error {
		attemptCount++
		// Return a non-transient error (NotFound)
		return apierrors.NewNotFound(schema.GroupResource{Group: "test", Resource: "pods"}, "test-pod")
	})

	// Should fail immediately without retries
	require.Error(t, err)
	assert.Equal(t, 1, attemptCount, "should only attempt once for non-transient errors")
	assert.True(t, apierrors.IsNotFound(err), "error should still be NotFound")
}

func TestRetryWithBackoff_TransientErrorThenSuccess(t *testing.T) {
	ri := &retryResourceInterface{
		backoff: defaultRetryBackoff(),
	}

	attemptCount := 0
	err := ri.retryWithBackoff(context.Background(), func() error {
		attemptCount++
		if attemptCount < 3 {
			// Return a transient error for the first 2 attempts
			return apierrors.NewServiceUnavailable("service unavailable")
		}
		// Success on the 3rd attempt
		return nil
	})

	require.NoError(t, err)
	assert.Equal(t, 3, attemptCount, "should retry until success")
}

func TestRetryWithBackoff_AllRetriesExhausted(t *testing.T) {
	ri := &retryResourceInterface{
		backoff: defaultRetryBackoff(),
	}

	attemptCount := 0
	err := ri.retryWithBackoff(context.Background(), func() error {
		attemptCount++
		// Always return a transient error
		return apierrors.NewServiceUnavailable("service unavailable")
	})

	require.Error(t, err)
	assert.GreaterOrEqual(t, attemptCount, 3, "should attempt multiple retries before exhausting")
	assert.True(t, apierrors.IsServiceUnavailable(err), "error should still be ServiceUnavailable")
}

func TestRetryWithBackoff_ContextCancellation(t *testing.T) {
	ri := &retryResourceInterface{
		backoff: defaultRetryBackoff(),
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	attemptCount := 0
	err := ri.retryWithBackoff(ctx, func() error {
		attemptCount++
		return apierrors.NewServiceUnavailable("service unavailable")
	})

	require.Error(t, err)
	assert.Equal(t, context.Canceled, err)
	assert.LessOrEqual(t, attemptCount, 1, "should not retry when context is canceled")
}

func TestRetryWithBackoff_ManagedRepositoryError(t *testing.T) {
	ri := &retryResourceInterface{
		backoff: defaultRetryBackoff(),
	}

	attemptCount := 0
	managedErr := errors.New("this resource is managed by a repository")
	err := ri.retryWithBackoff(context.Background(), func() error {
		attemptCount++
		return managedErr
	})

	require.Error(t, err)
	assert.Equal(t, 1, attemptCount, "should not retry 'managed by repository' errors")
	assert.Equal(t, managedErr, err)
}

// netTimeoutError is a test helper that implements net.Error with Timeout() = true
type netTimeoutError struct {
	msg string
}

func (e *netTimeoutError) Error() string   { return e.msg }
func (e *netTimeoutError) Timeout() bool   { return true }
func (e *netTimeoutError) Temporary() bool { return true }

var _ net.Error = (*netTimeoutError)(nil)
