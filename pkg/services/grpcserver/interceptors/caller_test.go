package interceptors

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/apiserver/identity"
)

func TestCallerUnaryServerInterceptor(t *testing.T) {
	interceptor := CallerUnaryServerInterceptor()

	t.Run("extracts from metadata", func(t *testing.T) {
		md := metadata.New(map[string]string{identity.MetadataKeyUpstreamCaller: "service-a"})
		ctx := metadata.NewIncomingContext(t.Context(), md)

		var got string
		_, err := interceptor(ctx, nil, &grpc.UnaryServerInfo{}, func(ctx context.Context, _ any) (any, error) {
			got = identity.UpstreamCallerFromContext(ctx)
			return nil, nil
		})
		require.NoError(t, err)
		require.Equal(t, "service-a", got)
	})

	t.Run("falls back to auth info", func(t *testing.T) {
		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"serviceIdentity": {"service-a"}},
		})

		var got string
		_, err := interceptor(ctx, nil, &grpc.UnaryServerInfo{}, func(ctx context.Context, _ any) (any, error) {
			got = identity.UpstreamCallerFromContext(ctx)
			return nil, nil
		})
		require.NoError(t, err)
		require.Equal(t, "service-a", got)
	})

	t.Run("preserves inbound over auth info (chain preservation)", func(t *testing.T) {
		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{"serviceIdentity": {"service-b"}},
		})
		md := metadata.New(map[string]string{identity.MetadataKeyUpstreamCaller: "service-a"})
		ctx = metadata.NewIncomingContext(ctx, md)

		var got string
		_, err := interceptor(ctx, nil, &grpc.UnaryServerInfo{}, func(ctx context.Context, _ any) (any, error) {
			got = identity.UpstreamCallerFromContext(ctx)
			return nil, nil
		})
		require.NoError(t, err)
		require.Equal(t, "service-a", got)
	})

	t.Run("no-op when no metadata and no auth info", func(t *testing.T) {
		var got string
		_, err := interceptor(t.Context(), nil, &grpc.UnaryServerInfo{}, func(ctx context.Context, _ any) (any, error) {
			got = identity.UpstreamCallerFromContext(ctx)
			return nil, nil
		})
		require.NoError(t, err)
		require.Equal(t, "", got)
	})
}

func TestCallerUnaryClientInterceptor(t *testing.T) {
	interceptor := CallerUnaryClientInterceptor()

	t.Run("propagates from context to outgoing metadata", func(t *testing.T) {
		ctx := identity.WithUpstreamCaller(t.Context(), "service-a")

		var gotMD metadata.MD
		err := interceptor(ctx, "/test", nil, nil, nil, func(ctx context.Context, _ string, _, _ any, _ *grpc.ClientConn, _ ...grpc.CallOption) error {
			gotMD, _ = metadata.FromOutgoingContext(ctx)
			return nil
		})
		require.NoError(t, err)
		require.Equal(t, []string{"service-a"}, gotMD.Get(identity.MetadataKeyUpstreamCaller))
	})

	t.Run("preserves existing outgoing metadata", func(t *testing.T) {
		ctx := identity.WithUpstreamCaller(t.Context(), "service-b")
		ctx = metadata.AppendToOutgoingContext(ctx, identity.MetadataKeyUpstreamCaller, "service-a")

		var gotMD metadata.MD
		err := interceptor(ctx, "/test", nil, nil, nil, func(ctx context.Context, _ string, _, _ any, _ *grpc.ClientConn, _ ...grpc.CallOption) error {
			gotMD, _ = metadata.FromOutgoingContext(ctx)
			return nil
		})
		require.NoError(t, err)
		require.Equal(t, []string{"service-a"}, gotMD.Get(identity.MetadataKeyUpstreamCaller))
	})

	t.Run("no-op when no caller in context", func(t *testing.T) {
		var gotMD metadata.MD
		err := interceptor(t.Context(), "/test", nil, nil, nil, func(ctx context.Context, _ string, _, _ any, _ *grpc.ClientConn, _ ...grpc.CallOption) error {
			gotMD, _ = metadata.FromOutgoingContext(ctx)
			return nil
		})
		require.NoError(t, err)
		require.Empty(t, gotMD.Get(identity.MetadataKeyUpstreamCaller))
	})
}

type fakeAuthInfo struct {
	types.AuthInfo
	extra map[string][]string
}

func (f *fakeAuthInfo) GetExtra() map[string][]string { return f.extra }
