package resources

import (
	"context"
	"errors"
	"net"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
)

// defaultRetryBackoff returns a default backoff configuration for retries.
//
// Retry attempts will happen when:
//   - The Kubernetes API returns transient errors: ServiceUnavailable (503), ServerTimeout (504),
//     TooManyRequests (429), InternalError (500), or Timeout errors
//   - Network errors occur: connection timeouts, temporary network failures, or connection errors
//
// The retry behavior:
//   - Total attempts: 8 (1 initial attempt + 7 retries)
//   - Initial delay: 100ms before the first retry
//   - Exponential backoff: delay doubles after each failed attempt (100ms → 200ms → 400ms → 800ms → 1.6s → 3.2s → 5s)
//   - Maximum delay: capped at 5 seconds
//   - Jitter: 10% randomization to prevent thundering herd problems
//   - Total retry window: approximately 10 seconds from first attempt to last retry
//
// All attempts will fail when:
//   - The Kubernetes API server is completely unavailable or unreachable
//   - Network connectivity issues persist beyond the retry window (~10 seconds)
//   - The API server returns transient errors consistently for the entire retry duration
//   - Context cancellation occurs before retries complete
//
// Non-transient errors (e.g., NotFound, BadRequest, Forbidden) are not retried and returned immediately.
func defaultRetryBackoff() wait.Backoff {
	return wait.Backoff{
		Duration: 100 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    8, // 1 initial attempt + 7 retries = 8 total attempts (~10s total retry window)
		Cap:      5 * time.Second,
	}
}

// retryResourceInterface wraps a dynamic.ResourceInterface with retry logic for transient errors
type retryResourceInterface struct {
	client  dynamic.ResourceInterface
	backoff wait.Backoff
}

// newRetryResourceInterface creates a new ResourceInterface wrapper with retry logic
func newRetryResourceInterface(client dynamic.ResourceInterface, backoff wait.Backoff) dynamic.ResourceInterface {
	return &retryResourceInterface{
		client:  client,
		backoff: backoff,
	}
}

// isTransientError determines if an error is transient and should be retried
func isTransientError(err error) bool {
	if err == nil {
		return false
	}

	// Check for Kubernetes API transient errors
	if apierrors.IsServiceUnavailable(err) {
		return true
	}
	if apierrors.IsServerTimeout(err) {
		return true
	}
	if apierrors.IsTooManyRequests(err) {
		return true
	}
	if apierrors.IsInternalError(err) {
		return true
	}
	if apierrors.IsTimeout(err) {
		return true
	}

	// Check for network errors
	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return true
		}
	}

	// Check for connection errors
	var opErr *net.OpError
	return errors.As(err, &opErr)
}

// retryWithBackoff executes a function with exponential backoff retry logic using wait.ExponentialBackoff
func (r *retryResourceInterface) retryWithBackoff(ctx context.Context, fn func() error) error {
	var lastErr error
	attempt := 0
	logger := logging.FromContext(ctx)

	err := wait.ExponentialBackoff(r.backoff, func() (bool, error) {
		attempt++

		// Check if context is cancelled
		if ctx.Err() != nil {
			logger.Debug("Retry cancelled due to context cancellation", "attempt", attempt)
			return false, ctx.Err()
		}

		err := fn()
		if err == nil {
			if attempt > 1 {
				logger.Debug("Operation succeeded after retry", "attempt", attempt)
			}
			return true, nil // success, stop retrying
		}

		// If not a transient error, return immediately without retrying
		if !isTransientError(err) {
			logger.Debug("Non-transient error, not retrying", "attempt", attempt, "error", err)
			return false, err
		}

		// Transient error, retry
		lastErr = err
		logger.Info("Transient error encountered, retrying", "attempt", attempt, "max_attempts", r.backoff.Steps, "error", err)
		return false, nil
	})

	// If wait.ExponentialBackoff returned an error, it means we exhausted retries
	if err != nil {
		if lastErr != nil {
			logger.Warn("All retry attempts exhausted", "total_attempts", attempt, "error", lastErr)
			return lastErr
		}
		logger.Warn("All retry attempts exhausted", "total_attempts", attempt, "error", err)
		return err
	}

	return nil
}

// Create implements dynamic.ResourceInterface
func (r *retryResourceInterface) Create(ctx context.Context, obj *unstructured.Unstructured, options metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	var result *unstructured.Unstructured
	var err error

	retryErr := r.retryWithBackoff(ctx, func() error {
		result, err = r.client.Create(ctx, obj, options, subresources...)
		return err
	})

	if retryErr != nil {
		return nil, retryErr
	}
	return result, nil
}

// Update implements dynamic.ResourceInterface
func (r *retryResourceInterface) Update(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	var result *unstructured.Unstructured
	var err error

	retryErr := r.retryWithBackoff(ctx, func() error {
		result, err = r.client.Update(ctx, obj, options, subresources...)
		return err
	})

	if retryErr != nil {
		return nil, retryErr
	}
	return result, nil
}

// UpdateStatus implements dynamic.ResourceInterface
func (r *retryResourceInterface) UpdateStatus(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	var result *unstructured.Unstructured
	var err error

	retryErr := r.retryWithBackoff(ctx, func() error {
		result, err = r.client.UpdateStatus(ctx, obj, options)
		return err
	})

	if retryErr != nil {
		return nil, retryErr
	}
	return result, nil
}

// Delete implements dynamic.ResourceInterface
func (r *retryResourceInterface) Delete(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
	return r.retryWithBackoff(ctx, func() error {
		return r.client.Delete(ctx, name, options, subresources...)
	})
}

// DeleteCollection implements dynamic.ResourceInterface
func (r *retryResourceInterface) DeleteCollection(ctx context.Context, options metav1.DeleteOptions, listOptions metav1.ListOptions) error {
	return r.retryWithBackoff(ctx, func() error {
		return r.client.DeleteCollection(ctx, options, listOptions)
	})
}

// Get implements dynamic.ResourceInterface
func (r *retryResourceInterface) Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	var result *unstructured.Unstructured
	var err error

	retryErr := r.retryWithBackoff(ctx, func() error {
		result, err = r.client.Get(ctx, name, options, subresources...)
		return err
	})

	if retryErr != nil {
		return nil, retryErr
	}
	return result, nil
}

// List implements dynamic.ResourceInterface
func (r *retryResourceInterface) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	var result *unstructured.UnstructuredList
	var err error

	retryErr := r.retryWithBackoff(ctx, func() error {
		result, err = r.client.List(ctx, opts)
		return err
	})

	if retryErr != nil {
		return nil, retryErr
	}
	return result, nil
}

// Watch implements dynamic.ResourceInterface
func (r *retryResourceInterface) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	// Watch operations are long-lived and shouldn't be retried in the same way
	// Return the watch interface directly
	return r.client.Watch(ctx, opts)
}

// Patch implements dynamic.ResourceInterface
func (r *retryResourceInterface) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
	var result *unstructured.Unstructured
	var err error

	retryErr := r.retryWithBackoff(ctx, func() error {
		result, err = r.client.Patch(ctx, name, pt, data, options, subresources...)
		return err
	})

	if retryErr != nil {
		return nil, retryErr
	}
	return result, nil
}

// Apply implements dynamic.ResourceInterface
func (r *retryResourceInterface) Apply(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions, subresources ...string) (*unstructured.Unstructured, error) {
	var result *unstructured.Unstructured
	var err error

	retryErr := r.retryWithBackoff(ctx, func() error {
		result, err = r.client.Apply(ctx, name, obj, options, subresources...)
		return err
	})

	if retryErr != nil {
		return nil, retryErr
	}
	return result, nil
}

// ApplyStatus implements dynamic.ResourceInterface
func (r *retryResourceInterface) ApplyStatus(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	var result *unstructured.Unstructured
	var err error

	retryErr := r.retryWithBackoff(ctx, func() error {
		result, err = r.client.ApplyStatus(ctx, name, obj, options)
		return err
	})

	if retryErr != nil {
		return nil, retryErr
	}
	return result, nil
}
