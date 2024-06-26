package client

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/wrapperspb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
)

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
		// TODO what should be the default value?
		c.tenantID = "default"
	}

	store, err := c.getOrCreateStore(ctx, c.tenantID)
	if err != nil {
		return nil, err
	}

	c.storeID = store.GetId()

	model, err := schema.TransformToModel(schema.DSL)
	if err != nil {
		return nil, err
	}

	modelID, err := c.loadModel(ctx, c.storeID, model)
	if err != nil {
		return nil, err
	}

	c.modelID = modelID

	return c, nil
}

func (c *Client) Check(ctx context.Context, in *openfgav1.CheckRequest, opts ...grpc.CallOption) (*openfgav1.CheckResponse, error) {
	return c.client.Check(ctx, in, opts...)
}

func (c *Client) ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest, opts ...grpc.CallOption) (*openfgav1.ListObjectsResponse, error) {
	return c.client.ListObjects(ctx, in, opts...)
}

func (c *Client) getOrCreateStore(ctx context.Context, name string) (*openfgav1.Store, error) {
	store, err := c.getStore(ctx, name)

	if errors.Is(err, errStoreNotFound) {
		var res *openfgav1.CreateStoreResponse
		res, err = c.client.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: name})
		if res != nil {
			store = &openfgav1.Store{
				Id:        res.GetId(),
				Name:      res.GetName(),
				CreatedAt: res.GetCreatedAt(),
			}
		}
	}

	return store, err
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

func (c *Client) loadModel(ctx context.Context, storeID string, model *openfgav1.AuthorizationModel) (string, error) {
	// ReadAuthorizationModels returns authorization models for a store sorted in descending order of creation.
	// So with a pageSize of 1 we will get the latest model.
	readRes, err := c.client.ReadAuthorizationModels(ctx, &openfgav1.ReadAuthorizationModelsRequest{
		StoreId:  storeID,
		PageSize: &wrapperspb.Int32Value{Value: 1},
	})

	if err != nil {
		return "", fmt.Errorf("failed to load authorization model: %w", err)
	}

	if len(readRes.GetAuthorizationModels()) == 1 {
		fmt.Println(schema.EqualModels(model, readRes.AuthorizationModels[0]))
	}

	/*
		writeRes, err := c.client.WriteAuthorizationModel(ctx, &openfgav1.WriteAuthorizationModelRequest{
			StoreId:         c.storeID,
			TypeDefinitions: model.GetTypeDefinitions(),
			SchemaVersion:   model.GetSchemaVersion(),
			Conditions:      model.GetConditions(),
		})

		if err != nil {
			return "", fmt.Errorf("failed to load authorization model: %w", err)
		}

		return writeRes.GetAuthorizationModelId(), nil
	*/
	return "", nil
}
