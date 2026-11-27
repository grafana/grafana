package authz

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
)

func invokeWithTimeoutInterceptor(t *testing.T, ctx context.Context, timeout time.Duration) (time.Time, bool) {
	t.Helper()
	var deadline time.Time
	var hasDeadline bool
	invoker := func(ctx context.Context, _ string, _, _ any, _ *grpc.ClientConn, _ ...grpc.CallOption) error {
		deadline, hasDeadline = ctx.Deadline()
		return nil
	}
	err := timeoutUnaryClientInterceptor(timeout)(ctx, "/authz.v1.AuthzService/Check", nil, nil, nil, invoker)
	require.NoError(t, err)
	return deadline, hasDeadline
}

func TestTimeoutUnaryClientInterceptor(t *testing.T) {
	t.Run("adds deadline when ctx has none", func(t *testing.T) {
		before := time.Now()
		deadline, ok := invokeWithTimeoutInterceptor(t, context.Background(), 2*time.Second)
		require.True(t, ok)
		require.WithinRange(t, deadline, before.Add(2*time.Second), time.Now().Add(2*time.Second))
	})

	t.Run("shortens later existing deadline", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		existing, _ := ctx.Deadline()

		deadline, ok := invokeWithTimeoutInterceptor(t, ctx, 2*time.Second)
		require.True(t, ok)
		require.True(t, deadline.Before(existing))
		require.WithinDuration(t, time.Now().Add(2*time.Second), deadline, time.Second)
	})

	t.Run("keeps earlier existing deadline", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		existing, _ := ctx.Deadline()

		deadline, ok := invokeWithTimeoutInterceptor(t, ctx, 2*time.Second)
		require.True(t, ok)
		require.Equal(t, existing, deadline)
	})

	t.Run("no-op when disabled", func(t *testing.T) {
		_, ok := invokeWithTimeoutInterceptor(t, context.Background(), 0)
		require.False(t, ok)

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		existing, _ := ctx.Deadline()
		deadline, ok := invokeWithTimeoutInterceptor(t, ctx, 0)
		require.True(t, ok)
		require.Equal(t, existing, deadline)
	})
}
