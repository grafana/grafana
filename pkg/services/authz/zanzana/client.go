package zanzana

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/wrapperspb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Client is a wrapper around OpenFGAServiceClient with only methods using in Grafana included.
type Client interface {
	// OpenFGAServiceClient methods
	Check(ctx context.Context, in *openfgav1.CheckRequest, opts ...grpc.CallOption) (*openfgav1.CheckResponse, error)
	ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest, opts ...grpc.CallOption) (*openfgav1.ListObjectsResponse, error)

	// Grafana-specific methods
	LoadModel(ctx context.Context, model *openfgav1.AuthorizationModel) error
}

type zanzanaClient struct {
	client openfgav1.OpenFGAServiceClient
	logger log.Logger

	tenantID             string
	storeName            string
	storeUID             string
	AuthorizationModelID string
}

func NewClient(cc grpc.ClientConnInterface, tenantID string) Client {
	return &zanzanaClient{
		client:    openfgav1.NewOpenFGAServiceClient(cc),
		logger:    log.New("zanzana-client"),
		tenantID:  tenantID,
		storeName: fmt.Sprintf("store-%v", tenantID),
	}
}

func (c *zanzanaClient) Check(ctx context.Context, in *openfgav1.CheckRequest, opts ...grpc.CallOption) (*openfgav1.CheckResponse, error) {
	return c.client.Check(ctx, in, opts...)
}

func (c *zanzanaClient) ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest, opts ...grpc.CallOption) (*openfgav1.ListObjectsResponse, error) {
	return c.client.ListObjects(ctx, in, opts...)
}

func (c *zanzanaClient) GetOrCreateStore(ctx context.Context) (string, error) {
	list, err := c.client.ListStores(ctx, &openfgav1.ListStoresRequest{PageSize: wrapperspb.Int32(20)})
	if err != nil {
		return "", err
	}

	for _, store := range list.Stores {
		if store.Name == c.storeName {
			return store.Id, nil
		}
	}

	resp, err := c.client.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: c.storeName})
	if err != nil {
		return "", err
	}

	return resp.Id, nil
}

func (c *zanzanaClient) MustStoreUID(ctx context.Context) string {
	if c.storeUID == "" {
		storeId, err := c.GetOrCreateStore(ctx)
		if err != nil {
			panic(err)
		}

		c.storeUID = storeId
	}

	return c.storeUID
}

func (c *zanzanaClient) LoadModel(ctx context.Context, model *openfgav1.AuthorizationModel) error {
	body := openfgav1.WriteAuthorizationModelRequest{
		Conditions:      model.Conditions,
		SchemaVersion:   model.SchemaVersion,
		TypeDefinitions: model.TypeDefinitions,
		StoreId:         c.MustStoreUID(ctx),
	}

	respModel, err := c.client.WriteAuthorizationModel(ctx, &body)
	if err != nil {
		return err
	}

	c.AuthorizationModelID = respModel.AuthorizationModelId
	return nil
}

type NoopClient struct{}

func (nc NoopClient) Check(ctx context.Context, in *openfgav1.CheckRequest, opts ...grpc.CallOption) (*openfgav1.CheckResponse, error) {
	return nil, nil
}

func (nc NoopClient) ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest, opts ...grpc.CallOption) (*openfgav1.ListObjectsResponse, error) {
	return nil, nil
}

func (nc NoopClient) LoadModel(ctx context.Context, model *openfgav1.AuthorizationModel) error {
	return nil
}
