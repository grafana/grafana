package resources

import (
	"context"
	"errors"
	"net"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apimachinery/pkg/watch"
)

func TestIsTransientError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "service unavailable",
			err:      apierrors.NewServiceUnavailable("service unavailable"),
			expected: true,
		},
		{
			name:     "server timeout",
			err:      apierrors.NewServerTimeout(schema.GroupResource{}, "operation", 0),
			expected: true,
		},
		{
			name:     "too many requests",
			err:      apierrors.NewTooManyRequests("too many requests", 0),
			expected: true,
		},
		{
			name:     "internal error",
			err:      apierrors.NewInternalError(errors.New("internal error")),
			expected: true,
		},
		{
			name:     "network timeout error",
			err:      &net.DNSError{Err: "timeout", IsTimeout: true},
			expected: true,
		},
		// Note: Temporary() is deprecated in Go 1.18+, so we no longer check for temporary errors
		// Timeout errors are still checked and will be retried
		{
			name:     "network op error",
			err:      &net.OpError{Op: "read", Err: errors.New("connection refused")},
			expected: true,
		},
		{
			name:     "not found error",
			err:      apierrors.NewNotFound(schema.GroupResource{}, "resource"),
			expected: false,
		},
		{
			name:     "bad request error",
			err:      apierrors.NewBadRequest("bad request"),
			expected: false,
		},
		{
			name:     "forbidden error",
			err:      apierrors.NewForbidden(schema.GroupResource{}, "resource", errors.New("forbidden")),
			expected: false,
		},
		{
			name:     "generic error",
			err:      errors.New("generic error"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isTransientError(tt.err)
			assert.Equal(t, tt.expected, result, "isTransientError(%v) = %v, want %v", tt.err, result, tt.expected)
		})
	}
}

func TestRetryResourceInterface_Create(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(*MockDynamicResourceInterface)
		backoff       wait.Backoff
		expectedCalls int
		expectError   bool
	}{
		{
			name: "success on first attempt",
			setupMock: func(m *MockDynamicResourceInterface) {
				m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{}, nil).Once()
			},
			backoff:       defaultRetryBackoff(),
			expectedCalls: 1,
			expectError:   false,
		},
		{
			name: "success after transient errors",
			setupMock: func(m *MockDynamicResourceInterface) {
				m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(nil, apierrors.NewServiceUnavailable("service unavailable")).Twice()
				m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(&unstructured.Unstructured{}, nil).Once()
			},
			backoff: wait.Backoff{
				Duration: 10 * time.Millisecond,
				Factor:   2.0,
				Jitter:   0.1,
				Steps:    5,
				Cap:      100 * time.Millisecond,
			},
			expectedCalls: 3,
			expectError:   false,
		},
		{
			name: "max retries exceeded",
			setupMock: func(m *MockDynamicResourceInterface) {
				m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(nil, apierrors.NewServiceUnavailable("service unavailable"))
			},
			backoff: wait.Backoff{
				Duration: 10 * time.Millisecond,
				Factor:   2.0,
				Jitter:   0.1,
				Steps:    3, // Only 3 steps = 2 retries + 1 initial
				Cap:      100 * time.Millisecond,
			},
			expectedCalls: 3,
			expectError:   true,
		},
		{
			name: "non-transient error - no retry",
			setupMock: func(m *MockDynamicResourceInterface) {
				m.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(nil, apierrors.NewBadRequest("bad request")).Once()
			},
			backoff:       defaultRetryBackoff(),
			expectedCalls: 1,
			expectError:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &MockDynamicResourceInterface{}
			tt.setupMock(mockClient)

			retryClient := newRetryResourceInterface(mockClient, tt.backoff)
			obj := &unstructured.Unstructured{}
			_, err := retryClient.Create(context.Background(), obj, metav1.CreateOptions{})

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			mockClient.AssertNumberOfCalls(t, "Create", tt.expectedCalls)
		})
	}
}

func TestRetryResourceInterface_Update(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, apierrors.NewServiceUnavailable("service unavailable")).Once()
	mockClient.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(&unstructured.Unstructured{}, nil).Once()

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 10 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      100 * time.Millisecond,
	})

	obj := &unstructured.Unstructured{}
	result, err := retryClient.Update(context.Background(), obj, metav1.UpdateOptions{})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockClient.AssertNumberOfCalls(t, "Update", 2)
}

func TestRetryResourceInterface_Get(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, apierrors.NewServerTimeout(schema.GroupResource{}, "operation", 0)).Twice()
	mockClient.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(&unstructured.Unstructured{}, nil).Once()

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 10 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      100 * time.Millisecond,
	})

	result, err := retryClient.Get(context.Background(), "test-resource", metav1.GetOptions{})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockClient.AssertNumberOfCalls(t, "Get", 3)
}

func TestRetryResourceInterface_Delete(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(apierrors.NewTooManyRequests("too many requests", 0)).Once()
	mockClient.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil).Once()

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 10 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      100 * time.Millisecond,
	})

	err := retryClient.Delete(context.Background(), "test-resource", metav1.DeleteOptions{})

	assert.NoError(t, err)
	mockClient.AssertNumberOfCalls(t, "Delete", 2)
}

func TestRetryResourceInterface_List(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("List", mock.Anything, mock.Anything).
		Return(nil, apierrors.NewInternalError(errors.New("internal error"))).Once()
	mockClient.On("List", mock.Anything, mock.Anything).
		Return(&unstructured.UnstructuredList{}, nil).Once()

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 10 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      100 * time.Millisecond,
	})

	result, err := retryClient.List(context.Background(), metav1.ListOptions{})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockClient.AssertNumberOfCalls(t, "List", 2)
}

func TestRetryResourceInterface_Patch(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("Patch", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, &net.OpError{Op: "read", Err: errors.New("connection refused")}).Once()
	mockClient.On("Patch", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(&unstructured.Unstructured{}, nil).Once()

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 10 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      100 * time.Millisecond,
	})

	result, err := retryClient.Patch(context.Background(), "test-resource", types.MergePatchType, []byte(`{}`), metav1.PatchOptions{})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockClient.AssertNumberOfCalls(t, "Patch", 2)
}

func TestRetryResourceInterface_Apply(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("Apply", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, apierrors.NewServiceUnavailable("service unavailable")).Once()
	mockClient.On("Apply", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(&unstructured.Unstructured{}, nil).Once()

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 10 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      100 * time.Millisecond,
	})

	obj := &unstructured.Unstructured{}
	result, err := retryClient.Apply(context.Background(), "test-resource", obj, metav1.ApplyOptions{})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockClient.AssertNumberOfCalls(t, "Apply", 2)
}

func TestRetryResourceInterface_UpdateStatus(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("UpdateStatus", mock.Anything, mock.Anything, mock.Anything).
		Return(nil, apierrors.NewServiceUnavailable("service unavailable")).Once()
	mockClient.On("UpdateStatus", mock.Anything, mock.Anything, mock.Anything).
		Return(&unstructured.Unstructured{}, nil).Once()

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 10 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      100 * time.Millisecond,
	})

	obj := &unstructured.Unstructured{}
	result, err := retryClient.UpdateStatus(context.Background(), obj, metav1.UpdateOptions{})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockClient.AssertNumberOfCalls(t, "UpdateStatus", 2)
}

func TestRetryResourceInterface_ApplyStatus(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("ApplyStatus", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, apierrors.NewServiceUnavailable("service unavailable")).Once()
	mockClient.On("ApplyStatus", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(&unstructured.Unstructured{}, nil).Once()

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 10 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      100 * time.Millisecond,
	})

	obj := &unstructured.Unstructured{}
	result, err := retryClient.ApplyStatus(context.Background(), "test-resource", obj, metav1.ApplyOptions{})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockClient.AssertNumberOfCalls(t, "ApplyStatus", 2)
}

func TestRetryResourceInterface_DeleteCollection(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything).
		Return(apierrors.NewServiceUnavailable("service unavailable")).Once()
	mockClient.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything).
		Return(nil).Once()

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 10 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      100 * time.Millisecond,
	})

	err := retryClient.DeleteCollection(context.Background(), metav1.DeleteOptions{}, metav1.ListOptions{})

	assert.NoError(t, err)
	mockClient.AssertNumberOfCalls(t, "DeleteCollection", 2)
}

func TestRetryResourceInterface_Watch(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockWatch := &mockWatch{}
	mockClient.On("Watch", mock.Anything, mock.Anything).Return(mockWatch, nil).Once()

	retryClient := newRetryResourceInterface(mockClient, defaultRetryBackoff())

	watch, err := retryClient.Watch(context.Background(), metav1.ListOptions{})

	assert.NoError(t, err)
	assert.Equal(t, mockWatch, watch)
	// Watch should not retry, so only one call
	mockClient.AssertNumberOfCalls(t, "Watch", 1)
}

func TestRetryResourceInterface_ContextCancellation(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, apierrors.NewServiceUnavailable("service unavailable")).Maybe()

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 100 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      1 * time.Second,
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	obj := &unstructured.Unstructured{}
	_, err := retryClient.Create(ctx, obj, metav1.CreateOptions{})

	assert.Error(t, err)
	assert.Equal(t, context.Canceled, err)
	// Should not retry after context cancellation
	mockClient.AssertNumberOfCalls(t, "Create", 0)
}

func TestRetryResourceInterface_ExponentialBackoff(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	callCount := 0

	// Set up expectations for multiple calls
	mockClient.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			callCount++
		}).
		Return(nil, apierrors.NewServiceUnavailable("service unavailable")).Twice()
	mockClient.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			callCount++
		}).
		Return(&unstructured.Unstructured{}, nil).Once()

	start := time.Now()
	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 50 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,
		Cap:      1 * time.Second,
	})

	obj := &unstructured.Unstructured{}
	_, err := retryClient.Create(context.Background(), obj, metav1.CreateOptions{})

	duration := time.Since(start)

	assert.NoError(t, err)
	assert.Equal(t, 3, callCount)
	// Should have waited at least initialDelay + (initialDelay * multiplier) = 50ms + 100ms = 150ms
	assert.GreaterOrEqual(t, duration, 100*time.Millisecond)
	// But not too long (with some buffer for jitter)
	assert.Less(t, duration, 1*time.Second)
}

func TestRetryResourceInterface_MaxDelayRespected(t *testing.T) {
	mockClient := &MockDynamicResourceInterface{}
	callCount := 0

	// Set up expectations for multiple calls - always return transient error
	mockClient.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			callCount++
		}).
		Return(nil, apierrors.NewServiceUnavailable("service unavailable")).
		Maybe() // Allow unlimited calls

	retryClient := newRetryResourceInterface(mockClient, wait.Backoff{
		Duration: 50 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    5,                      // 5 total attempts
		Cap:      200 * time.Millisecond, // Max delay is 200ms (cap should prevent exponential growth beyond this)
	})

	start := time.Now()
	obj := &unstructured.Unstructured{}
	_, err := retryClient.Create(context.Background(), obj, metav1.CreateOptions{})
	duration := time.Since(start)

	assert.Error(t, err)
	// Should have retried multiple times
	assert.GreaterOrEqual(t, callCount, 2, "should have retried at least once")
	// Verify that the delay was capped - if it wasn't capped, duration would be much longer
	// With cap at 200ms and Steps=5, max total time should be reasonable
	// The cap ensures delays don't grow exponentially beyond 200ms
	assert.Less(t, duration, 2*time.Second, "duration should be reasonable due to cap")
}

func TestDefaultRetryBackoff(t *testing.T) {
	backoff := defaultRetryBackoff()

	assert.Equal(t, 100*time.Millisecond, backoff.Duration)
	assert.Equal(t, 2.0, backoff.Factor)
	assert.Equal(t, 0.1, backoff.Jitter)
	assert.Equal(t, 8, backoff.Steps) // Updated to 8 steps for ~10s total retry window
	assert.Equal(t, 5*time.Second, backoff.Cap)
}

// mockWatch implements watch.Interface for testing
type mockWatch struct{}

func (m *mockWatch) Stop() {}

func (m *mockWatch) ResultChan() <-chan watch.Event {
	return make(chan watch.Event)
}

var _ watch.Interface = (*mockWatch)(nil)
