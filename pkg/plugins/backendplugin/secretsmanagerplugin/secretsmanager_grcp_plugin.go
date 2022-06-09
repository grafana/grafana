package secretsmanagerplugin

import (
	"context"

	"github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type SecretsManagerPlugin interface {
	RemoteSecretsManagerClient
}

type SecretsManagerGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
}

func (p *SecretsManagerGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	return nil
}

func (p *SecretsManagerGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &SecretsManagerGRPCClient{NewRemoteSecretsManagerClient(c)}, nil
}

type SecretsManagerGRPCClient struct {
	RemoteSecretsManagerClient
}

// Get an item from the store
func (sm *SecretsManagerGRPCClient) Get(ctx context.Context, req *SecretsGetRequest, opts ...grpc.CallOption) (*SecretsGetResponse, error) {
	return sm.RemoteSecretsManagerClient.Get(ctx, req)
}

// Set an item in the store
func (sm *SecretsManagerGRPCClient) Set(ctx context.Context, req *SecretsSetRequest, opts ...grpc.CallOption) (*SecretsErrorResponse, error) {
	return sm.RemoteSecretsManagerClient.Set(ctx, req)
}

// Del deletes an item from the store.
func (sm *SecretsManagerGRPCClient) Del(ctx context.Context, req *SecretsDelRequest, opts ...grpc.CallOption) (*SecretsErrorResponse, error) {
	return sm.RemoteSecretsManagerClient.Del(ctx, req)
}

// Keys get all keys for a given namespace.
func (sm *SecretsManagerGRPCClient) Keys(ctx context.Context, req *SecretsKeysRequest, opts ...grpc.CallOption) (*SecretsKeysResponse, error) {
	return sm.RemoteSecretsManagerClient.Keys(ctx, req)
}

// Rename an item in the store
func (sm *SecretsManagerGRPCClient) Rename(ctx context.Context, req *SecretsRenameRequest, opts ...grpc.CallOption) (*SecretsErrorResponse, error) {
	return sm.RemoteSecretsManagerClient.Rename(ctx, req)
}

var _ RemoteSecretsManagerClient = &SecretsManagerGRPCClient{}
var _ plugin.GRPCPlugin = &SecretsManagerGRPCPlugin{}
