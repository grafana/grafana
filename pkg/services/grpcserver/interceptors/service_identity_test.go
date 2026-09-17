package interceptors

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type fakeAuthInfo struct {
	types.AuthInfo
	extra map[string][]string
}

func (f *fakeAuthInfo) GetExtra() map[string][]string { return f.extra }

type fakeServerStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (f *fakeServerStream) Context() context.Context { return f.ctx }

func TestInnermostServiceIdentityUnaryServerInterceptor(t *testing.T) {
	t.Parallel()

	t.Run("no auth info on context: identity not set, handler invoked with original ctx", func(t *testing.T) {
		t.Parallel()

		var handlerCtx context.Context
		handler := func(ctx context.Context, _ any) (any, error) {
			handlerCtx = ctx
			return "ok", nil
		}

		resp, err := InnermostServiceIdentityUnaryServerInterceptor()(t.Context(), "req", &grpc.UnaryServerInfo{}, handler)
		require.NoError(t, err)
		require.Equal(t, "ok", resp)

		_, ok := identity.InnermostServiceIdentityFrom(handlerCtx)
		require.False(t, ok)
	})

	t.Run("auth info without the key: identity not set", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{extra: map[string][]string{}})

		var handlerCtx context.Context
		handler := func(ctx context.Context, _ any) (any, error) {
			handlerCtx = ctx
			return nil, nil
		}

		_, err := InnermostServiceIdentityUnaryServerInterceptor()(ctx, "req", &grpc.UnaryServerInfo{}, handler)
		require.NoError(t, err)

		_, ok := identity.InnermostServiceIdentityFrom(handlerCtx)
		require.False(t, ok)
	})

	t.Run("auth info with nil extra map: identity not set", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{extra: nil})

		var handlerCtx context.Context
		handler := func(ctx context.Context, _ any) (any, error) {
			handlerCtx = ctx
			return nil, nil
		}

		_, err := InnermostServiceIdentityUnaryServerInterceptor()(ctx, "req", &grpc.UnaryServerInfo{}, handler)
		require.NoError(t, err)

		_, ok := identity.InnermostServiceIdentityFrom(handlerCtx)
		require.False(t, ok)
	})

	t.Run("auth info with empty slice for the key: identity not set", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"innermostServiceIdentity": {}},
		})

		var handlerCtx context.Context
		handler := func(ctx context.Context, _ any) (any, error) {
			handlerCtx = ctx
			return nil, nil
		}

		_, err := InnermostServiceIdentityUnaryServerInterceptor()(ctx, "req", &grpc.UnaryServerInfo{}, handler)
		require.NoError(t, err)

		_, ok := identity.InnermostServiceIdentityFrom(handlerCtx)
		require.False(t, ok)
	})

	t.Run("auth info with empty string value: stored on ctx but InnermostServiceIdentityFrom reports absent", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"innermostServiceIdentity": {""}},
		})

		var handlerCtx context.Context
		handler := func(ctx context.Context, _ any) (any, error) {
			handlerCtx = ctx
			return nil, nil
		}

		_, err := InnermostServiceIdentityUnaryServerInterceptor()(ctx, "req", &grpc.UnaryServerInfo{}, handler)
		require.NoError(t, err)

		got, ok := identity.InnermostServiceIdentityFrom(handlerCtx)
		require.False(t, ok)
		require.Empty(t, got)
	})

	t.Run("auth info with a single value: identity is set on the handler ctx", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"innermostServiceIdentity": {"my-service"}},
		})

		var handlerCtx context.Context
		handler := func(ctx context.Context, _ any) (any, error) {
			handlerCtx = ctx
			return nil, nil
		}

		_, err := InnermostServiceIdentityUnaryServerInterceptor()(ctx, "req", &grpc.UnaryServerInfo{}, handler)
		require.NoError(t, err)

		got, ok := identity.InnermostServiceIdentityFrom(handlerCtx)
		require.True(t, ok)
		require.Equal(t, "my-service", got)
	})

	t.Run("auth info with multiple values: only the first value is used", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"innermostServiceIdentity": {"first", "second"}},
		})

		var handlerCtx context.Context
		handler := func(ctx context.Context, _ any) (any, error) {
			handlerCtx = ctx
			return nil, nil
		}

		_, err := InnermostServiceIdentityUnaryServerInterceptor()(ctx, "req", &grpc.UnaryServerInfo{}, handler)
		require.NoError(t, err)

		got, ok := identity.InnermostServiceIdentityFrom(handlerCtx)
		require.True(t, ok)
		require.Equal(t, "first", got)
	})

	t.Run("handler error and response are propagated unchanged", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"innermostServiceIdentity": {"svc"}},
		})
		sentinel := errors.New("boom")
		handler := func(_ context.Context, _ any) (any, error) {
			return "payload", sentinel
		}

		resp, err := InnermostServiceIdentityUnaryServerInterceptor()(ctx, "req", &grpc.UnaryServerInfo{}, handler)
		require.ErrorIs(t, err, sentinel)
		require.Equal(t, "payload", resp)
	})
}

func TestInnermostServiceIdentityStreamServerInterceptor(t *testing.T) {
	t.Parallel()

	t.Run("no auth info on context: original stream is forwarded, identity not set", func(t *testing.T) {
		t.Parallel()

		ss := &fakeServerStream{ctx: t.Context()}

		var handlerStream grpc.ServerStream
		handler := func(_ any, stream grpc.ServerStream) error {
			handlerStream = stream
			return nil
		}

		require.NoError(t, InnermostServiceIdentityStreamServerInterceptor()(nil, ss, &grpc.StreamServerInfo{}, handler))
		require.Same(t, ss, handlerStream)

		_, ok := identity.InnermostServiceIdentityFrom(handlerStream.Context())
		require.False(t, ok)
	})

	t.Run("auth info without the extra key: original stream is forwarded", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{extra: map[string][]string{}})
		ss := &fakeServerStream{ctx: ctx}

		var handlerStream grpc.ServerStream
		handler := func(_ any, stream grpc.ServerStream) error {
			handlerStream = stream
			return nil
		}

		require.NoError(t, InnermostServiceIdentityStreamServerInterceptor()(nil, ss, &grpc.StreamServerInfo{}, handler))
		require.Same(t, ss, handlerStream)

		_, ok := identity.InnermostServiceIdentityFrom(handlerStream.Context())
		require.False(t, ok)
	})

	t.Run("auth info with empty slice for the key: original stream is forwarded", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"innermostServiceIdentity": {}},
		})
		ss := &fakeServerStream{ctx: ctx}

		var handlerStream grpc.ServerStream
		handler := func(_ any, stream grpc.ServerStream) error {
			handlerStream = stream
			return nil
		}

		require.NoError(t, InnermostServiceIdentityStreamServerInterceptor()(nil, ss, &grpc.StreamServerInfo{}, handler))
		require.Same(t, ss, handlerStream)
	})

	t.Run("auth info with empty string value: stream is wrapped but identity not retrievable", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"innermostServiceIdentity": {""}},
		})
		ss := &fakeServerStream{ctx: ctx}

		var handlerStream grpc.ServerStream
		handler := func(_ any, stream grpc.ServerStream) error {
			handlerStream = stream
			return nil
		}

		require.NoError(t, InnermostServiceIdentityStreamServerInterceptor()(nil, ss, &grpc.StreamServerInfo{}, handler))
		require.NotSame(t, ss, handlerStream)

		_, ok := identity.InnermostServiceIdentityFrom(handlerStream.Context())
		require.False(t, ok)
	})

	t.Run("auth info with a single value: stream is wrapped and exposes the identity via Context()", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"innermostServiceIdentity": {"my-service"}},
		})
		ss := &fakeServerStream{ctx: ctx}

		var handlerStream grpc.ServerStream
		handler := func(_ any, stream grpc.ServerStream) error {
			handlerStream = stream
			return nil
		}

		require.NoError(t, InnermostServiceIdentityStreamServerInterceptor()(nil, ss, &grpc.StreamServerInfo{}, handler))
		require.NotSame(t, ss, handlerStream)

		got, ok := identity.InnermostServiceIdentityFrom(handlerStream.Context())
		require.True(t, ok)
		require.Equal(t, "my-service", got)
	})

	t.Run("auth info with multiple values: only the first value is used", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"innermostServiceIdentity": {"first", "second"}},
		})
		ss := &fakeServerStream{ctx: ctx}

		var handlerStream grpc.ServerStream
		handler := func(_ any, stream grpc.ServerStream) error {
			handlerStream = stream
			return nil
		}

		require.NoError(t, InnermostServiceIdentityStreamServerInterceptor()(nil, ss, &grpc.StreamServerInfo{}, handler))

		got, ok := identity.InnermostServiceIdentityFrom(handlerStream.Context())
		require.True(t, ok)
		require.Equal(t, "first", got)
	})

	t.Run("handler error is propagated", func(t *testing.T) {
		t.Parallel()

		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"innermostServiceIdentity": {"svc"}},
		})
		ss := &fakeServerStream{ctx: ctx}
		sentinel := errors.New("boom")
		handler := func(_ any, _ grpc.ServerStream) error {
			return sentinel
		}

		err := InnermostServiceIdentityStreamServerInterceptor()(nil, ss, &grpc.StreamServerInfo{}, handler)
		require.ErrorIs(t, err, sentinel)
	})
}
