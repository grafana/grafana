package server

import (
	"context"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/language/pkg/go/transformer"
	"google.golang.org/protobuf/types/known/wrapperspb"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
)

// GetOrCreateStore returns store information about store for a given namespace.
// This is used by the reconciler to access store IDs for direct operations.
func (s *Server) GetOrCreateStore(ctx context.Context, namespace string) (*zanzana.StoreInfo, error) {
	return s.getStoreInfo(ctx, namespace)
}

func (s *Server) getStoreInfo(ctx context.Context, namespace string) (*zanzana.StoreInfo, error) {
	s.storesMU.Lock()
	defer s.storesMU.Unlock()
	info, ok := s.stores[namespace]
	if ok {
		return &info, nil
	}

	store, err := s.getOrCreateStore(ctx, namespace)
	if err != nil {
		return nil, err
	}

	modelID, err := s.loadModel(ctx, store.GetId(), schema.SchemaModules)
	if err != nil {
		return nil, err
	}

	info = zanzana.StoreInfo{
		ID:      store.GetId(),
		Name:    store.GetName(),
		ModelID: modelID,
	}

	s.stores[namespace] = info

	return &info, nil
}

func (s *Server) GetStore(ctx context.Context, namespace string) (*zanzana.StoreInfo, error) {
	s.storesMU.Lock()
	defer s.storesMU.Unlock()
	info, ok := s.stores[namespace]
	if ok {
		return &zanzana.StoreInfo{
			ID:   info.ID,
			Name: info.Name,
		}, nil
	}

	res, err := s.openFGAClient.ListStores(ctx, &openfgav1.ListStoresRequest{Name: namespace})
	if err != nil {
		return nil, fmt.Errorf("failed to load zanzana stores: %w", err)
	}

	for _, s := range res.GetStores() {
		if s.GetName() == namespace {
			return &zanzana.StoreInfo{
				ID:   s.GetId(),
				Name: s.GetName(),
			}, nil
		}
	}

	return nil, zanzana.ErrStoreNotFound
}

func (s *Server) getOrCreateStore(ctx context.Context, namespace string) (*openfgav1.Store, error) {
	res, err := s.openFGAClient.ListStores(ctx, &openfgav1.ListStoresRequest{Name: namespace})
	if err != nil {
		return nil, fmt.Errorf("failed to load zanzana stores: %w", err)
	}

	for _, s := range res.GetStores() {
		if s.GetName() == namespace {
			return s, nil
		}
	}

	createStoreRes, err := s.openFGAClient.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: namespace})
	if err != nil {
		return nil, err
	}

	return &openfgav1.Store{
		Id:   createStoreRes.GetId(),
		Name: createStoreRes.GetName(),
	}, nil
}

func (s *Server) loadModel(ctx context.Context, storeID string, modules []transformer.ModuleFile) (string, error) {
	var continuationToken string

	model, err := schema.TransformModulesToModel(modules)
	if err != nil {
		return "", err
	}

	// ReadAuthorizationModels returns authorization models for a store sorted in descending order of creation.
	// So with a pageSize of 1 we will get the latest model.
	res, err := s.openFGAClient.ReadAuthorizationModels(ctx, &openfgav1.ReadAuthorizationModelsRequest{
		StoreId:           storeID,
		PageSize:          &wrapperspb.Int32Value{Value: 1},
		ContinuationToken: continuationToken,
	})

	if err != nil {
		return "", fmt.Errorf("failed to load authorization model: %w", err)
	}

	for _, m := range res.GetAuthorizationModels() {
		// If provided dsl is equal to a stored dsl we use that as the authorization id
		if schema.EqualModels(m, model) {
			return m.GetId(), nil
		}
	}

	writeRes, err := s.openFGAClient.WriteAuthorizationModel(ctx, &openfgav1.WriteAuthorizationModelRequest{
		StoreId:         storeID,
		TypeDefinitions: model.GetTypeDefinitions(),
		SchemaVersion:   model.GetSchemaVersion(),
		Conditions:      model.GetConditions(),
	})

	if err != nil {
		return "", fmt.Errorf("failed to load authorization model: %w", err)
	}

	return writeRes.GetAuthorizationModelId(), nil
}

// ListAllStores returns all OpenFGA stores with pagination support.
// Each store name corresponds to a namespace in the system.
// Returns only ID and Name to minimize memory allocation.
func (s *Server) ListAllStores(ctx context.Context) ([]zanzana.StoreInfo, error) {
	var stores []zanzana.StoreInfo
	var continuationToken string

	for {
		res, err := s.GetOpenFGAServer().ListStores(ctx, &openfgav1.ListStoresRequest{
			ContinuationToken: continuationToken,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to list zanzana stores: %w", err)
		}

		for _, store := range res.GetStores() {
			stores = append(stores, zanzana.StoreInfo{
				ID:   store.GetId(),
				Name: store.GetName(),
			})
		}

		if res.GetContinuationToken() == "" {
			break
		}
		continuationToken = res.GetContinuationToken()
	}

	return stores, nil
}
