package secretsmanagerplugin

import (
	"context"

	"github.com/hashicorp/go-plugin"
	"google.golang.org/grpc"
)

type SecretsManagerPlugin interface {
	SecretsManagerClient
}

type SecretsManagerGRPCPlugin struct {
	plugin.NetRPCUnsupportedPlugin
}

func (p *SecretsManagerGRPCPlugin) GRPCServer(broker *plugin.GRPCBroker, s *grpc.Server) error {
	return nil
}

func (p *SecretsManagerGRPCPlugin) GRPCClient(ctx context.Context, broker *plugin.GRPCBroker, c *grpc.ClientConn) (interface{}, error) {
	return &SecretsManagerGRPCClient{NewSecretsManagerClient(c)}, nil
}

type SecretsManagerGRPCClient struct {
	SecretsManagerClient
}

// Get an item from the store
func (sm *SecretsManagerGRPCClient) Get(ctx context.Context, req *GetSecretRequest, opts ...grpc.CallOption) (*GetSecretResponse, error) {
	return sm.SecretsManagerClient.Get(ctx, req)
}

// Set an item in the store
func (sm *SecretsManagerGRPCClient) Set(ctx context.Context, req *SetSecretRequest, opts ...grpc.CallOption) (*SetSecretResponse, error) {
	return sm.SecretsManagerClient.Set(ctx, req)
}

// Del deletes an item from the store.
func (sm *SecretsManagerGRPCClient) Del(ctx context.Context, req *DelSecretRequest, opts ...grpc.CallOption) (*DelSecretResponse, error) {
	return sm.SecretsManagerClient.Del(ctx, req)
}

// Keys get all keys for a given namespace.
func (sm *SecretsManagerGRPCClient) Keys(ctx context.Context, req *ListSecretsRequest, opts ...grpc.CallOption) (*ListSecretsResponse, error) {
	return sm.SecretsManagerClient.Keys(ctx, req)
}

// Rename an item in the store
func (sm *SecretsManagerGRPCClient) Rename(ctx context.Context, req *RenameSecretRequest, opts ...grpc.CallOption) (*RenameSecretResponse, error) {
	return sm.SecretsManagerClient.Rename(ctx, req)
}

var _ SecretsManagerClient = &SecretsManagerGRPCClient{}
var _ plugin.GRPCPlugin = &SecretsManagerGRPCPlugin{}
