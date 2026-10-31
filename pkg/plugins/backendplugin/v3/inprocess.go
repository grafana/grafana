package v3

import (
	"context"
	"errors"
	"fmt"
	"net"

	"github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"

	clientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	appgrpcplugin "github.com/grafana/grafana-app-sdk/plugin/grpcplugin"
)

const inProcessBufferSize = 1 << 20

// NewInProcessClient serves the v3 services in opts from this process, and
// returns the client for them with the function that stops the server.
//
// Requests go through a gRPC connection held in memory, and the services are
// the SDK's own, so they authenticate each request as a plugin process does:
// opts.Authenticator verifies the access token the host's client adds, and the
// app's kube client then acts as that caller. Without an Authenticator, or
// opts.InsecureSkipAuthentication, every request is rejected.
func NewInProcessClient(opts appgrpcplugin.ServeOpts) (clientv3.Client, func(), error) {
	server := grpc.NewServer()
	for key, p := range opts.PluginSet() {
		gp, ok := p.(plugin.GRPCPlugin)
		if !ok {
			return nil, nil, fmt.Errorf("v3 service %q cannot be served over gRPC", key)
		}
		if err := gp.GRPCServer(nil, server); err != nil {
			return nil, nil, fmt.Errorf("registering v3 service %q: %w", key, err)
		}
	}

	lis := bufconn.Listen(inProcessBufferSize)
	go func() {
		if err := server.Serve(lis); err != nil && !errors.Is(err, grpc.ErrServerStopped) {
			// Serve only fails on a listener error, and a bufconn has none.
			panic(fmt.Sprintf("in-process v3 server: %v", err))
		}
	}()

	conn, err := grpc.NewClient("passthrough:///in-process",
		grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return lis.Dial() }),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		server.Stop()
		return nil, nil, fmt.Errorf("connecting to the in-process v3 server: %w", err)
	}
	client, err := appgrpcplugin.NewClientV3FromConn(conn, appgrpcplugin.ClientV3Options{})
	if err != nil {
		_ = conn.Close()
		server.Stop()
		return nil, nil, err
	}
	return client, func() {
		_ = conn.Close()
		server.Stop()
	}, nil
}
