package server

import (
	"context"
	"errors"
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
	info, err := s.GetStore(ctx, namespace)
	if err != nil && !errors.Is(err, zanzana.ErrStoreNotFound) {
		return nil, err
	}

	if errors.Is(err, zanzana.ErrStoreNotFound) {
		createStoreRes, err := s.openFGAClient.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: namespace})
		if err != nil {
			return nil, err
		}

		info = &zanzana.StoreInfo{
			ID:   createStoreRes.GetId(),
			Name: createStoreRes.GetName(),
		}

		s.storesMU.Lock()
		s.stores[namespace] = *info
		s.storesMU.Unlock()
	}

	if info.ModelID == "" {
		modelID, err := s.loadModel(ctx, info.ID, schema.SchemaModules)
		if err != nil {
			return nil, err
		}

		s.storesMU.Lock()
		info.ModelID = modelID
		s.stores[namespace] = *info
		s.storesMU.Unlock()
	}

	return info, nil
}

func (s *Server) GetStore(ctx context.Context, namespace string) (*zanzana.StoreInfo, error) {
	s.storesMU.Lock()
	defer s.storesMU.Unlock()

	info, ok := s.stores[namespace]
	if ok {
		return &zanzana.StoreInfo{
			ID:      info.ID,
			Name:    info.Name,
			ModelID: info.ModelID,
		}, nil
	}

	res, err := s.openFGAClient.ListStores(ctx, &openfgav1.ListStoresRequest{Name: namespace})
	if err != nil {
		return nil, fmt.Errorf("failed to load zanzana stores: %w", err)
	}

	for _, store := range res.GetStores() {
		if store.GetName() == namespace {
			info = zanzana.StoreInfo{
				ID:   store.GetId(),
				Name: store.GetName(),
			}

			s.stores[namespace] = info

			return &zanzana.StoreInfo{
				ID:   info.ID,
				Name: info.Name,
			}, nil
		}
	}

	return nil, zanzana.ErrStoreNotFound
}

// DeleteStore removes a store from the local cache and deletes it from OpenFGA.
// This is used by the reconciler to clean up stores for deleted/archived namespaces.
func (s *Server) DeleteStore(ctx context.Context, namespace string) error {
	info, ok := s.removeStore(namespace)
	if !ok {
		return nil
	}

	_, err := s.openFGAClient.DeleteStore(ctx, &openfgav1.DeleteStoreRequest{StoreId: info.ID})
	return err
}

func (s *Server) removeStore(namespace string) (zanzana.StoreInfo, bool) {
	s.storesMU.Lock()
	defer s.storesMU.Unlock()

	info, ok := s.stores[namespace]
	delete(s.stores, namespace)
	return info, ok
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
