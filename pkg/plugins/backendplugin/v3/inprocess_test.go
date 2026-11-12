package v3

import (
	"errors"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	appgrpcplugin "github.com/grafana/grafana-app-sdk/plugin/grpcplugin"
)

type fakeRoute struct {
	pluginv3.UnimplementedRouteServiceServer
	send int
	err  error
}

func (f *fakeRoute) CallRoute(_ *pluginv3.CallRouteRequest, stream grpc.ServerStreamingServer[pluginv3.CallRouteResponse]) error {
	for range f.send {
		if err := stream.Send(&pluginv3.CallRouteResponse{}); err != nil {
			return err
		}
	}
	return f.err
}

func recvAll(t *testing.T, opts appgrpcplugin.ServeOpts) (n int, err error) {
	client, stop, cerr := NewInProcessClient(opts)
	require.NoError(t, cerr)
	t.Cleanup(stop)

	req := &pluginv3.CallRouteRequest{}
	req.SetGroup("g")
	req.SetNamespace("default")
	stream, cerr := client.CallRoute(t.Context(), req)
	require.NoError(t, cerr)
	for {
		if _, err = stream.Recv(); err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return n, err
		}
		n++
	}
}

func TestInProcessClient(t *testing.T) {
	t.Run("streams a route's messages", func(t *testing.T) {
		n, err := recvAll(t, appgrpcplugin.ServeOpts{
			RouteServer:                &fakeRoute{send: 3},
			InsecureSkipAuthentication: true,
		})
		require.NoError(t, err)
		require.Equal(t, 3, n)
	})

	t.Run("passes the route's error on", func(t *testing.T) {
		n, err := recvAll(t, appgrpcplugin.ServeOpts{
			RouteServer:                &fakeRoute{send: 1, err: status.Error(codes.NotFound, "gone")},
			InsecureSkipAuthentication: true,
		})
		require.Equal(t, 1, n)
		require.Equal(t, codes.NotFound, status.Code(err))
	})

	t.Run("rejects requests without an authenticator", func(t *testing.T) {
		_, err := recvAll(t, appgrpcplugin.ServeOpts{RouteServer: &fakeRoute{send: 1}})
		require.Equal(t, codes.FailedPrecondition, status.Code(err))
	})
}
