package zanzana

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/server"
	"github.com/openfga/openfga/pkg/storage"
	"google.golang.org/protobuf/types/known/wrapperspb"

	"github.com/grafana/grafana/pkg/infra/log"
)

func NewServer(store storage.OpenFGADatastore, logger log.Logger) (*server.Server, error) {
	// FIXME(kalleep): add support for more options, tracing etc
	opts := []server.OpenFGAServiceV1Option{
		server.WithDatastore(store),
		server.WithLogger(newZanzanaLogger(logger)),
	}

	// FIXME(kalleep): Interceptors
	// We probably need to at least need to add store id interceptor also
	// would be nice to inject our own requestid?
	srv, err := server.NewServerWithOpts(opts...)
	if err != nil {
		return nil, err
	}

	return srv, nil
}

func GetOrCreateStore(ctx context.Context, srv *server.Server, storeName string) (string, error) {
	list, err := srv.ListStores(ctx, &openfgav1.ListStoresRequest{PageSize: wrapperspb.Int32(20)})
	if err != nil {
		return "", err
	}

	for _, store := range list.Stores {
		if store.Name == storeName {
			return store.Id, nil
		}
	}

	resp, err := srv.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: storeName})
	if err != nil {
		return "", err
	}

	return resp.Id, nil
}

func MustStoreUID(ctx context.Context, srv *server.Server, storeName string) string {
	storeId, err := GetOrCreateStore(ctx, srv, storeName)
	if err != nil {
		panic(err)
	}

	return storeId
}

func LoadModel(ctx context.Context, model *openfgav1.AuthorizationModel, srv *server.Server, storeName string) (string, error) {
	body := openfgav1.WriteAuthorizationModelRequest{
		Conditions:      model.Conditions,
		SchemaVersion:   model.SchemaVersion,
		TypeDefinitions: model.TypeDefinitions,
		StoreId:         MustStoreUID(ctx, srv, storeName),
	}

	respModel, err := srv.WriteAuthorizationModel(ctx, &body)
	if err != nil {
		return "", err
	}

	return respModel.AuthorizationModelId, nil
}
