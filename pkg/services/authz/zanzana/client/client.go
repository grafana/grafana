package client

import (
	"context"
	"errors"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/wrapperspb"

	"github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
)

var _ authz.AccessClient = (*Client)(nil)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/authz/zanzana/client")

type ClientOption func(c *Client)

func WithTenantID(tenantID string) ClientOption {
	return func(c *Client) {
		c.tenantID = tenantID
	}
}

func WithLogger(logger log.Logger) ClientOption {
	return func(c *Client) {
		c.logger = logger
	}
}

type Client struct {
	logger   log.Logger
	openfga  openfgav1.OpenFGAServiceClient
	authz    authzv1.AuthzServiceClient
	authzext authzextv1.AuthzExtentionServiceClient

	tenantID string
	storeID  string
	modelID  string
}

func New(ctx context.Context, cc grpc.ClientConnInterface, opts ...ClientOption) (*Client, error) {
	c := &Client{
		openfga:  openfgav1.NewOpenFGAServiceClient(cc),
		authz:    authzv1.NewAuthzServiceClient(cc),
		authzext: authzextv1.NewAuthzExtentionServiceClient(cc),
	}

	for _, o := range opts {
		o(c)
	}

	if c.logger == nil {
		c.logger = log.NewNopLogger()
	}

	if c.tenantID == "" {
		c.tenantID = "stacks-default"
	}

	store, err := c.getStore(ctx, c.tenantID)
	if err != nil {
		return nil, err
	}

	c.storeID = store.GetId()

	modelID, err := c.loadModel(ctx, c.storeID)
	if err != nil {
		return nil, err
	}

	c.modelID = modelID

	return c, nil
}

// Check implements authz.AccessClient.
func (c *Client) Check(ctx context.Context, id claims.AuthInfo, req authz.CheckRequest) (authz.CheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authz.zanzana.client.Check")
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
		return authz.CheckResponse{}, err
	}

	return authz.CheckResponse{Allowed: res.GetAllowed()}, nil
}

func (c *Client) Compile(ctx context.Context, id claims.AuthInfo, req authz.ListRequest) (authz.ItemChecker, error) {
	ctx, span := tracer.Start(ctx, "authz.zanzana.client.Compile")
	defer span.End()

	_, err := c.authzext.List(ctx, &authzextv1.ListRequest{
		Subject:   id.GetUID(),
		Group:     req.Group,
		Verb:      utils.VerbList,
		Resource:  req.Resource,
		Namespace: req.Namespace,
	})

	if err != nil {
		return nil, err
	}

	// FIXME: implement checker
	return func(namespace, name, folder string) bool { return false }, nil
}

func (c *Client) List(ctx context.Context, id claims.AuthInfo, req authz.ListRequest) (*authzextv1.ListResponse, error) {
	ctx, span := tracer.Start(ctx, "authz.zanzana.client.List")
	defer span.End()

	return c.authzext.List(ctx, &authzextv1.ListRequest{
		Subject:   id.GetUID(),
		Group:     req.Group,
		Verb:      utils.VerbList,
		Resource:  req.Resource,
		Namespace: req.Namespace,
	})
}

func (c *Client) Read(ctx context.Context, in *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error) {
	ctx, span := tracer.Start(ctx, "authz.zanzana.client.Read")
	defer span.End()

	in.StoreId = c.storeID
	return c.openfga.Read(ctx, in)
}

func (c *Client) Write(ctx context.Context, in *openfgav1.WriteRequest) error {
	in.StoreId = c.storeID
	in.AuthorizationModelId = c.modelID
	_, err := c.openfga.Write(ctx, in)
	return err
}

var errStoreNotFound = errors.New("store not found")

func (c *Client) getStore(ctx context.Context, name string) (*openfgav1.Store, error) {
	var continuationToken string

	// OpenFGA client does not support any filters for stores.
	// We should create an issue to support some way to get stores by name.
	// For now we need to go thourh all stores until we find a match or we hit the end.
	for {
		res, err := c.openfga.ListStores(ctx, &openfgav1.ListStoresRequest{
			PageSize:          &wrapperspb.Int32Value{Value: 20},
			ContinuationToken: continuationToken,
		})

		if err != nil {
			return nil, fmt.Errorf("failed to initiate zanzana tenant: %w", err)
		}

		for _, s := range res.GetStores() {
			if s.GetName() == name {
				return s, nil
			}
		}

		// we have no more stores to check
		if res.GetContinuationToken() == "" {
			return nil, errStoreNotFound
		}

		continuationToken = res.GetContinuationToken()
	}
}

func (c *Client) loadModel(ctx context.Context, storeID string) (string, error) {
	// ReadAuthorizationModels returns authorization models for a store sorted in descending order of creation.
	// So with a pageSize of 1 we will get the latest model.
	res, err := c.openfga.ReadAuthorizationModels(ctx, &openfgav1.ReadAuthorizationModelsRequest{
		StoreId:  storeID,
		PageSize: &wrapperspb.Int32Value{Value: 1},
	})

	if err != nil {
		return "", fmt.Errorf("failed to load latest authorization model: %w", err)
	}

	if len(res.AuthorizationModels) != 1 {
		return "", fmt.Errorf("failed to load latest authorization model")
	}

	return res.AuthorizationModels[0].GetId(), nil
}
