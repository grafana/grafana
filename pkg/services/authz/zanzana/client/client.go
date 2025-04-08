package client

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authlib "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

var _ authlib.AccessClient = (*Client)(nil)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/authz/zanzana/client")

type Client struct {
	logger   log.Logger
	authz    authzv1.AuthzServiceClient
	authzext authzextv1.AuthzExtentionServiceClient
}

func New(cc grpc.ClientConnInterface) (*Client, error) {
	c := &Client{
		authz:    authzv1.NewAuthzServiceClient(cc),
		authzext: authzextv1.NewAuthzExtentionServiceClient(cc),
		logger:   log.New("zanzana-client"),
	}

	return c, nil
}

func (c *Client) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest) (authlib.CheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Check")
	defer span.End()

	res, err := c.authz.Check(ctx, &authzv1.CheckRequest{
		Subject:     id.GetUID(),
		Verb:        req.Verb,
		Group:       req.Group,
		Resource:    req.Resource,
		Namespace:   req.Namespace,
		Name:        req.Name,
		Subresource: req.Subresource,
		Path:        req.Path,
		Folder:      req.Folder,
	})

	if err != nil {
		return authlib.CheckResponse{}, err
	}

	return authlib.CheckResponse{Allowed: res.GetAllowed()}, nil
}

func (c *Client) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Compile")
	defer span.End()

	res, err := c.authz.List(ctx, &authzv1.ListRequest{
		Subject:   id.GetUID(),
		Group:     req.Group,
		Verb:      utils.VerbList,
		Resource:  req.Resource,
		Namespace: req.Namespace,
	})

	if err != nil {
		return nil, err
	}

	return newItemChecker(res), nil
}

func newItemChecker(res *authzv1.ListResponse) authlib.ItemChecker {
	// if we can see all resource of this type we can just return a function that always return true
	if res.GetAll() {
		return func(_, _ string) bool { return true }
	}

	folders := make(map[string]struct{}, len(res.Folders))
	for _, f := range res.Folders {
		folders[f] = struct{}{}
	}

	items := make(map[string]struct{}, len(res.Items))
	for _, i := range res.Items {
		items[i] = struct{}{}
	}

	return func(name, folder string) bool {
		if _, ok := items[name]; ok {
			return true
		}
		if _, ok := folders[folder]; ok {
			return true
		}
		return false
	}
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
