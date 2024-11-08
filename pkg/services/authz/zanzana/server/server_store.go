package server

import (
	"context"
	"errors"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/language/pkg/go/transformer"
	"google.golang.org/protobuf/types/known/wrapperspb"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
)

func (s *Server) getOrCreateStore(ctx context.Context, namespace string) (*openfgav1.Store, error) {
	store, err := s.getStore(ctx, namespace)

	if errors.Is(err, errStoreNotFound) {
		var res *openfgav1.CreateStoreResponse
		res, err = s.openfga.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: namespace})
		if res != nil {
			store = &openfgav1.Store{
				Id:        res.GetId(),
				Name:      res.GetName(),
				CreatedAt: res.GetCreatedAt(),
			}
			s.storeMap[res.GetName()] = storeInfo{
				Id: res.GetId(),
			}
		}
	}

	return store, err
}

func (s *Server) getStoreInfo(namespace string) (*storeInfo, error) {
	info, ok := s.storeMap[namespace]
	if !ok {
		return nil, errStoreNotFound
	}

	return &info, nil
}

func (s *Server) getStore(ctx context.Context, namespace string) (*openfgav1.Store, error) {
	if len(s.storeMap) == 0 {
		err := s.initStores(ctx)
		if err != nil {
			return nil, err
		}
	}

	storeInf, err := s.getStoreInfo(namespace)
	if err != nil {
		return nil, err
	}

	res, err := s.openfga.GetStore(ctx, &openfgav1.GetStoreRequest{
		StoreId: storeInf.Id,
	})
	if err != nil {
		return nil, err
	}

	store := &openfgav1.Store{
		Id:        res.GetId(),
		Name:      res.GetName(),
		CreatedAt: res.GetCreatedAt(),
	}

	return store, nil
}

func (s *Server) initStores(ctx context.Context) error {
	var continuationToken string

	for {
		res, err := s.openfga.ListStores(ctx, &openfgav1.ListStoresRequest{
			PageSize:          &wrapperspb.Int32Value{Value: 100},
			ContinuationToken: continuationToken,
		})

		if err != nil {
			return fmt.Errorf("failed to load zanzana stores: %w", err)
		}

		for _, store := range res.GetStores() {
			name := store.GetName()
			s.storeMap[name] = storeInfo{
				Id: store.GetId(),
			}
		}

		// we have no more stores to check
		if res.GetContinuationToken() == "" {
			break
		}

		continuationToken = res.GetContinuationToken()
	}

	return nil
}

func (s *Server) loadModel(ctx context.Context, namespace string, modules []transformer.ModuleFile) (string, error) {
	var continuationToken string

	model, err := schema.TransformModulesToModel(modules)
	if err != nil {
		return "", err
	}

	store, err := s.getStore(ctx, namespace)
	if err != nil {
		return "", err
	}

	for {
		// ReadAuthorizationModels returns authorization models for a store sorted in descending order of creation.
		// So with a pageSize of 1 we will get the latest model.
		res, err := s.openfga.ReadAuthorizationModels(ctx, &openfgav1.ReadAuthorizationModelsRequest{
			StoreId:           store.GetId(),
			PageSize:          &wrapperspb.Int32Value{Value: 20},
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

		// If we have not found any matching authorization model we break the loop and create a new one
		if res.GetContinuationToken() == "" {
			break
		}

		continuationToken = res.GetContinuationToken()
	}

	writeRes, err := s.openfga.WriteAuthorizationModel(ctx, &openfgav1.WriteAuthorizationModelRequest{
		StoreId:         store.GetId(),
		TypeDefinitions: model.GetTypeDefinitions(),
		SchemaVersion:   model.GetSchemaVersion(),
		Conditions:      model.GetConditions(),
	})

	if err != nil {
		return "", fmt.Errorf("failed to load authorization model: %w", err)
	}

	return writeRes.GetAuthorizationModelId(), nil
}

func (s *Server) getNamespaceStore(ctx context.Context, namespace string) (*storeInfo, error) {
	var storeInf *storeInfo
	var err error

	s.storeLock.Lock()
	defer s.storeLock.Unlock()

	storeInf, err = s.getStoreInfo(namespace)
	if errors.Is(err, errStoreNotFound) || storeInf.AuthorizationModelId == "" {
		storeInf, err = s.initNamespaceStore(ctx, namespace)
	}
	if err != nil {
		return nil, err
	}

	return storeInf, nil
}

func (s *Server) initNamespaceStore(ctx context.Context, namespace string) (*storeInfo, error) {
	store, err := s.getOrCreateStore(ctx, namespace)
	if err != nil {
		return nil, err
	}

	modules := schema.SchemaModules
	modelID, err := s.loadModel(ctx, namespace, modules)
	if err != nil {
		return nil, err
	}

	if info, ok := s.storeMap[store.GetName()]; ok {
		s.storeMap[store.GetName()] = storeInfo{
			Id:                   info.Id,
			AuthorizationModelId: modelID,
		}
	}

	updatedInfo := s.storeMap[store.GetName()]
	return &updatedInfo, nil
}
