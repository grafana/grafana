package authz

import (
	"context"
	"testing"
	"time"

	grpc_retry "github.com/grpc-ecosystem/go-grpc-middleware/retry"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
)

func TestUnaryDefaultTimeout(t *testing.T) {
	callTimeout := 30 * time.Second
	interceptor := unaryDefaultTimeout(callTimeout)

	invoke := func(ctx context.Context) (deadline time.Time, ok bool, retryOpts int) {
		invoker := func(ctx context.Context, _ string, _, _ any, _ *grpc.ClientConn, opts ...grpc.CallOption) error {
			deadline, ok = ctx.Deadline()
			for _, o := range opts {
				if _, isRetryOpt := o.(grpc_retry.CallOption); isRetryOpt {
					retryOpts++
				}
			}
			return nil
		}
		require.NoError(t, interceptor(ctx, "method", nil, nil, nil, invoker))
		return deadline, ok, retryOpts
	}

	t.Run("adds deadline and per-attempt timeout when context has none", func(t *testing.T) {
		deadline, ok, retryOpts := invoke(context.Background())
		require.True(t, ok)
		require.WithinDuration(t, time.Now().Add(callTimeout), deadline, 5*time.Second)
		require.Equal(t, 1, retryOpts)
	})

	// Longer than the default deadline, so wrongly applying the default would tighten it
	// and fail the assertion; a shorter one would survive by winning the earlier-deadline rule.
	t.Run("keeps existing longer deadline and adds no per-attempt timeout", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		deadline, ok, retryOpts := invoke(ctx)
		require.True(t, ok)
		require.WithinDuration(t, time.Now().Add(60*time.Second), deadline, 5*time.Second)
		require.Zero(t, retryOpts)
	})
}
