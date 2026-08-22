package unified

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// TestUnaryRetryInterceptor_RetryableCodes guards the retry contract that is our
// own decision (not the grpc-middleware library's): which gRPC status codes the
// unified-storage client retries. The backoff/jitter mechanics are the library's
// and are tested there; here we only pin the retryable-code set and that the
// initial call plus WithMax(cfg.Max) attempts are made.
//
// If this test changes, make sure the retryable codes in unaryRetryInterceptor
// still match what callers and the storage servers rely on.
func TestUnaryRetryInterceptor_RetryableCodes(t *testing.T) {
	// Backoff 0 keeps the test instant; we assert on the code set and attempt
	// count, not on timing. Max is the number of attempts the library makes
	// (initial attempt included), so a always-failing retryable call is invoked
	// exactly cfg.Max times.
	const maxAttempts = 4
	interceptor := unaryRetryInterceptor(retryConfig{Max: maxAttempts, Backoff: 0, BackoffJitter: 0})

	tests := []struct {
		name      string
		code      codes.Code
		retryable bool
	}{
		{"ResourceExhausted is retried", codes.ResourceExhausted, true},
		{"Unavailable is retried", codes.Unavailable, true},
		{"Aborted is retried", codes.Aborted, true},
		{"OK is not retried", codes.OK, false},
		{"InvalidArgument is not retried", codes.InvalidArgument, false},
		{"NotFound is not retried", codes.NotFound, false},
		{"Internal is not retried", codes.Internal, false},
		{"DeadlineExceeded is not retried", codes.DeadlineExceeded, false},
		{"PermissionDenied is not retried", codes.PermissionDenied, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			invoker := func(_ context.Context, _ string, _, _ any, _ *grpc.ClientConn, _ ...grpc.CallOption) error {
				calls++
				if tc.code == codes.OK {
					return nil
				}
				return status.Error(tc.code, "injected failure")
			}

			err := interceptor(context.Background(), "/resource.ResourceStore/Read", nil, nil, nil, invoker)

			if tc.code == codes.OK {
				require.NoError(t, err)
			} else {
				require.Equal(t, tc.code, status.Code(err), "final error code should be preserved")
			}

			wantCalls := 1
			if tc.retryable {
				wantCalls = maxAttempts
			}
			require.Equal(t, wantCalls, calls, "unexpected number of invocations")
		})
	}
}
