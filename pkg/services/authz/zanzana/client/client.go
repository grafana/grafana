package client

import (
	"context"
	"errors"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/wrapperspb"

	"github.com/grafana/grafana/pkg/infra/log"
)

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
	client   openfgav1.OpenFGAServiceClient
	tenantID string
	storeID  string
	modelID  string
}

func New(ctx context.Context, cc grpc.ClientConnInterface, opts ...ClientOption) (*Client, error) {
	c := &Client{
		client: openfgav1.NewOpenFGAServiceClient(cc),
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

func (c *Client) Check(ctx context.Context, in *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authz.zanzana.client.Check")
	defer span.End()

	in.StoreId = c.storeID
	in.AuthorizationModelId = c.modelID
	return c.client.Check(ctx, in)
}

func (c *Client) Read(ctx context.Context, in *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error) {
	ctx, span := tracer.Start(ctx, "authz.zanzana.client.Read")
	defer span.End()

	in.StoreId = c.storeID
	return c.client.Read(ctx, in)
}

func (c *Client) ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	ctx, span := tracer.Start(ctx, "authz.zanzana.client.ListObjects")
	span.SetAttributes(attribute.String("resource.type", in.Type))
	defer span.End()

	in.StoreId = c.storeID
	in.AuthorizationModelId = c.modelID
	return c.client.ListObjects(ctx, in)
}

func (c *Client) Write(ctx context.Context, in *openfgav1.WriteRequest) error {
	in.StoreId = c.storeID
	in.AuthorizationModelId = c.modelID
	_, err := c.client.Write(ctx, in)
	return err
}

var errStoreNotFound = errors.New("store not found")

func (c *Client) getStore(ctx context.Context, name string) (*openfgav1.Store, error) {
	var continuationToken string

	// OpenFGA client does not support any filters for stores.
	// We should create an issue to support some way to get stores by name.
	// For now we need to go thourh all stores until we find a match or we hit the end.
	for {
		res, err := c.client.ListStores(ctx, &openfgav1.ListStoresRequest{
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
	res, err := c.client.ReadAuthorizationModels(ctx, &openfgav1.ReadAuthorizationModelsRequest{
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
