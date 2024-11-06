package server

import (
	"context"
	"errors"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/wrapperspb"
)

func (s *Server) getOrCreateStore(ctx context.Context, name string) (*openfgav1.Store, error) {
	store, err := s.getStore(ctx, name)

	if errors.Is(err, errStoreNotFound) {
		var res *openfgav1.CreateStoreResponse
		res, err = s.openfga.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: name})
		if res != nil {
			store = &openfgav1.Store{
				Id:        res.GetId(),
				Name:      res.GetName(),
				CreatedAt: res.GetCreatedAt(),
			}
			s.storeMap[res.GetName()] = res.GetId()
		}
	}

	return store, err
}

func (s *Server) getStore(ctx context.Context, name string) (*openfgav1.Store, error) {
	storeId, ok := s.storeMap[name]
	if !ok {
		return nil, errStoreNotFound
	}

	res, err := s.openfga.GetStore(ctx, &openfgav1.GetStoreRequest{
		StoreId: storeId,
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
	s.storeMap = make(map[string]string)
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
			s.storeMap[name] = store.GetId()
		}

		// we have no more stores to check
		if res.GetContinuationToken() == "" {
			break
		}

		continuationToken = res.GetContinuationToken()
	}

	return nil
}
