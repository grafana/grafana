package client

import (
	"context"

	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authlib "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

var _ authlib.AccessClient = (*Client)(nil)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/authz/zanzana/client")

type Client struct {
	logger         log.Logger
	authz          authzv1.AuthzServiceClient
	authzext       authzextv1.AuthzExtentionServiceClient
	authzlibclient *authzlib.ClientImpl
}

func New(cc grpc.ClientConnInterface) (*Client, error) {
	authzlibclient := authzlib.NewClient(cc, authzlib.WithTracerClientOption(tracer))
	c := &Client{
		authzlibclient: authzlibclient,
		authz:          authzv1.NewAuthzServiceClient(cc),
		authzext:       authzextv1.NewAuthzExtentionServiceClient(cc),
		logger:         log.New("zanzana.client"),
	}

	return c, nil
}

func (c *Client) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest) (authlib.CheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Check")
	defer span.End()

	return c.authzlibclient.Check(ctx, id, req)
}

func (c *Client) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Compile")
	defer span.End()

	return c.authzlibclient.Compile(ctx, id, req)
}

func (c *Client) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Read")
	defer span.End()

	return c.authzext.Read(ctx, req)
}

func (c *Client) Write(ctx context.Context, req *authzextv1.WriteRequest) error {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Write")
	defer span.End()

	_, err := c.authzext.Write(ctx, req)
	return err
}

func (c *Client) BatchCheck(ctx context.Context, req *authzextv1.BatchCheckRequest) (*authzextv1.BatchCheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Check")
	defer span.End()

	return c.authzext.BatchCheck(ctx, req)
}
