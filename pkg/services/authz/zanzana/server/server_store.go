package server

import (
	"context"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/language/pkg/go/transformer"
	"google.golang.org/protobuf/types/known/wrapperspb"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
)

func (s *Server) getStoreInfo(ctx context.Context, namespace string) (*storeInfo, error) {
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

	info = storeInfo{
		ID:      store.GetId(),
		ModelID: modelID,
	}

	s.stores[namespace] = info

	return &info, nil
}

func (s *Server) getOrCreateStore(ctx context.Context, namespace string) (*openfgav1.Store, error) {
	res, err := s.openfga.ListStores(ctx, &openfgav1.ListStoresRequest{Name: namespace})
	if err != nil {
		return nil, fmt.Errorf("failed to load zanzana stores: %w", err)
	}

	for _, s := range res.GetStores() {
		if s.GetName() == namespace {
			return s, nil
		}
	}

	createStoreRes, err := s.openfga.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: namespace})
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
	res, err := s.openfga.ReadAuthorizationModels(ctx, &openfgav1.ReadAuthorizationModelsRequest{
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

	writeRes, err := s.openfga.WriteAuthorizationModel(ctx, &openfgav1.WriteAuthorizationModelRequest{
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
