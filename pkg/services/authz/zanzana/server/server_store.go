package server

import (
	"context"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
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

	modelID, err := s.loadModel(ctx, store.GetId())
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

func (s *Server) getOrCreateStore(_ context.Context, namespace string) (*openfgav1.Store, error) {
	return &openfgav1.Store{
		Name: namespace,
		Id:   "00000000000000000000000000",
	}, nil
}

func (s *Server) loadModel(ctx context.Context, storeID string) (string, error) {
	model, err := s.store.FindLatestAuthorizationModel(ctx, storeID)
	if err != nil {
		return "", fmt.Errorf("failed to load authorization model: %w", err)
	}
	return model.GetId(), nil
}
