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
func (sm *SecretsManagerGRPCClient) GetSecret(ctx context.Context, req *GetSecretRequest, opts ...grpc.CallOption) (*GetSecretResponse, error) {
	return sm.SecretsManagerClient.GetSecret(ctx, req)
}

// Set an item in the store
func (sm *SecretsManagerGRPCClient) SetSecret(ctx context.Context, req *SetSecretRequest, opts ...grpc.CallOption) (*SetSecretResponse, error) {
	return sm.SecretsManagerClient.SetSecret(ctx, req)
}

// Del deletes an item from the store.
func (sm *SecretsManagerGRPCClient) DeleteSecret(ctx context.Context, req *DeleteSecretRequest, opts ...grpc.CallOption) (*DeleteSecretResponse, error) {
	return sm.SecretsManagerClient.DeleteSecret(ctx, req)
}

// Keys get all keys for a given namespace.
func (sm *SecretsManagerGRPCClient) ListSecrets(ctx context.Context, req *ListSecretsRequest, opts ...grpc.CallOption) (*ListSecretsResponse, error) {
	return sm.SecretsManagerClient.ListSecrets(ctx, req)
}

// Rename an item in the store
func (sm *SecretsManagerGRPCClient) RenameSecret(ctx context.Context, req *RenameSecretRequest, opts ...grpc.CallOption) (*RenameSecretResponse, error) {
	return sm.SecretsManagerClient.RenameSecret(ctx, req)
}

// Get all items from the store
func (sm *SecretsManagerGRPCClient) GetAllSecrets(ctx context.Context, req *GetAllSecretsRequest, opts ...grpc.CallOption) (*GetAllSecretsResponse, error) {
	return sm.SecretsManagerClient.GetAllSecrets(ctx, req)
}

var _ SecretsManagerClient = &SecretsManagerGRPCClient{}
var _ plugin.GRPCPlugin = &SecretsManagerGRPCPlugin{}
