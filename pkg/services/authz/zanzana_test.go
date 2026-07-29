package authz

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
)

func TestUnaryDefaultTimeout(t *testing.T) {
	interceptor := unaryDefaultTimeout(defaultCallTimeout)

	invoke := func(ctx context.Context) (deadline time.Time, ok bool) {
		invoker := func(ctx context.Context, _ string, _, _ any, _ *grpc.ClientConn, _ ...grpc.CallOption) error {
			deadline, ok = ctx.Deadline()
			return nil
		}
		require.NoError(t, interceptor(ctx, "method", nil, nil, nil, invoker))
		return deadline, ok
	}

	t.Run("adds deadline when context has none", func(t *testing.T) {
		deadline, ok := invoke(context.Background())
		require.True(t, ok)
		require.WithinDuration(t, time.Now().Add(defaultCallTimeout), deadline, 5*time.Second)
	})

	t.Run("keeps existing deadline", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()

		deadline, ok := invoke(ctx)
		require.True(t, ok)
		require.WithinDuration(t, time.Now().Add(time.Second), deadline, 5*time.Second)
	})
}
