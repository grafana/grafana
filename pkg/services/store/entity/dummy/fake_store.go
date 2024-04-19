package dummy

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/store/entity"
)

// Make sure we implement both store + admin
var _ entity.EntityStoreServer = &fakeEntityStore{}

func ProvideFakeEntityServer() entity.EntityStoreServer {
	return &fakeEntityStore{}
}

type fakeEntityStore struct{}

func (i fakeEntityStore) Create(ctx context.Context, r *entity.CreateEntityRequest) (*entity.CreateEntityResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) Update(ctx context.Context, r *entity.UpdateEntityRequest) (*entity.UpdateEntityResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) Read(ctx context.Context, r *entity.ReadEntityRequest) (*entity.Entity, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) Delete(ctx context.Context, r *entity.DeleteEntityRequest) (*entity.DeleteEntityResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) History(ctx context.Context, r *entity.EntityHistoryRequest) (*entity.EntityHistoryResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) List(ctx context.Context, r *entity.EntityListRequest) (*entity.EntityListResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) Watch(entity.EntityStore_WatchServer) error {
	return fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) FindReferences(ctx context.Context, r *entity.ReferenceRequest) (*entity.EntityListResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}
