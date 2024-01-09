package entity

import (
	context "context"
	"strconv"

	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	status "google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/appcontext"
)

var _ EntityStoreServer = (*entityStoreClientWrapper)(nil)

// wrapper for EntityStoreClient that implements EntityStore interface
type entityStoreClientWrapper struct {
	EntityStoreClient
}

func (c *entityStoreClientWrapper) Read(ctx context.Context, in *ReadEntityRequest) (*Entity, error) {
	ctx, err := c.wrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return c.EntityStoreClient.Read(ctx, in)
}
func (c *entityStoreClientWrapper) BatchRead(ctx context.Context, in *BatchReadEntityRequest) (*BatchReadEntityResponse, error) {
	ctx, err := c.wrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return c.EntityStoreClient.BatchRead(ctx, in)
}
func (c *entityStoreClientWrapper) Create(ctx context.Context, in *CreateEntityRequest) (*CreateEntityResponse, error) {
	ctx, err := c.wrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return c.EntityStoreClient.Create(ctx, in)
}
func (c *entityStoreClientWrapper) Update(ctx context.Context, in *UpdateEntityRequest) (*UpdateEntityResponse, error) {
	ctx, err := c.wrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return c.EntityStoreClient.Update(ctx, in)
}
func (c *entityStoreClientWrapper) Delete(ctx context.Context, in *DeleteEntityRequest) (*DeleteEntityResponse, error) {
	ctx, err := c.wrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return c.EntityStoreClient.Delete(ctx, in)
}
func (c *entityStoreClientWrapper) History(ctx context.Context, in *EntityHistoryRequest) (*EntityHistoryResponse, error) {
	ctx, err := c.wrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return c.EntityStoreClient.History(ctx, in)
}
func (c *entityStoreClientWrapper) List(ctx context.Context, in *EntityListRequest) (*EntityListResponse, error) {
	ctx, err := c.wrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return c.EntityStoreClient.List(ctx, in)
}
func (c *entityStoreClientWrapper) Watch(*EntityWatchRequest, EntityStore_WatchServer) error {
	return status.Errorf(codes.Unimplemented, "method Watch not implemented")
}

func (c *entityStoreClientWrapper) wrapContext(ctx context.Context) (context.Context, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	// set grpc metadata into the context to pass to the grpc server
	ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs(
		"grafana-idtoken", user.IDToken,
		"grafana-userid", strconv.FormatInt(user.UserID, 10),
		"grafana-orgid", strconv.FormatInt(user.OrgID, 10),
		"grafana-login", user.Login,
	))

	return ctx, nil
}

func NewEntityStoreClientWrapper(cc grpc.ClientConnInterface) EntityStoreServer {
	return &entityStoreClientWrapper{&entityStoreClient{cc}}
}
