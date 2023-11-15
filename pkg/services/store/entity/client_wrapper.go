package entity

import (
	context "context"

	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)

var _ EntityStoreServer = (*entityStoreClientWrapper)(nil)

// wrapper for EntityStoreClient that implements EntityStore interface
type entityStoreClientWrapper struct {
	EntityStoreClient
}

func (c *entityStoreClientWrapper) Read(ctx context.Context, in *ReadEntityRequest) (*Entity, error) {
	return c.EntityStoreClient.Read(ctx, in)
}
func (c *entityStoreClientWrapper) BatchRead(ctx context.Context, in *BatchReadEntityRequest) (*BatchReadEntityResponse, error) {
	return c.EntityStoreClient.BatchRead(ctx, in)
}
func (c *entityStoreClientWrapper) Write(ctx context.Context, in *WriteEntityRequest) (*WriteEntityResponse, error) {
	return c.EntityStoreClient.Write(ctx, in)
}
func (c *entityStoreClientWrapper) Create(ctx context.Context, in *CreateEntityRequest) (*CreateEntityResponse, error) {
	return c.EntityStoreClient.Create(ctx, in)
}
func (c *entityStoreClientWrapper) Update(ctx context.Context, in *UpdateEntityRequest) (*UpdateEntityResponse, error) {
	return c.EntityStoreClient.Update(ctx, in)
}
func (c *entityStoreClientWrapper) Delete(ctx context.Context, in *DeleteEntityRequest) (*DeleteEntityResponse, error) {
	return c.EntityStoreClient.Delete(ctx, in)
}
func (c *entityStoreClientWrapper) History(ctx context.Context, in *EntityHistoryRequest) (*EntityHistoryResponse, error) {
	return c.EntityStoreClient.History(ctx, in)
}
func (c *entityStoreClientWrapper) Search(ctx context.Context, in *EntitySearchRequest) (*EntitySearchResponse, error) {
	return c.EntityStoreClient.Search(ctx, in)
}
func (c *entityStoreClientWrapper) Watch(*EntityWatchRequest, EntityStore_WatchServer) error {
	return status.Errorf(codes.Unimplemented, "method Watch not implemented")
}

// TEMPORARY... while we split this into a new service (see below)
func (c *entityStoreClientWrapper) AdminWrite(ctx context.Context, in *AdminWriteEntityRequest) (*WriteEntityResponse, error) {
	return c.EntityStoreClient.AdminWrite(ctx, in)
}

func NewEntityStoreClientWrapper(cc grpc.ClientConnInterface) EntityStoreServer {
	return &entityStoreClientWrapper{&entityStoreClient{cc}}
}
