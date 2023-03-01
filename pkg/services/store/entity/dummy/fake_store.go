package dummy

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/store/entity"
)

// Make sure we implement both store + admin
var _ entity.EntityStoreServer = &fakeEntityStore{}
var _ entity.EntityStoreAdminServer = &fakeEntityStore{}

func ProvideFakeEntityServer() entity.EntityStoreServer {
	return &fakeEntityStore{}
}

type fakeEntityStore struct{}

func (i fakeEntityStore) AdminWrite(ctx context.Context, r *entity.AdminWriteEntityRequest) (*entity.WriteEntityResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) Write(ctx context.Context, r *entity.WriteEntityRequest) (*entity.WriteEntityResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) Read(ctx context.Context, r *entity.ReadEntityRequest) (*entity.Entity, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) BatchRead(ctx context.Context, batchR *entity.BatchReadEntityRequest) (*entity.BatchReadEntityResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) Delete(ctx context.Context, r *entity.DeleteEntityRequest) (*entity.DeleteEntityResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) History(ctx context.Context, r *entity.EntityHistoryRequest) (*entity.EntityHistoryResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) Search(ctx context.Context, r *entity.EntitySearchRequest) (*entity.EntitySearchResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeEntityStore) Watch(*entity.EntityWatchRequest, entity.EntityStore_WatchServer) error {
	return fmt.Errorf("unimplemented")
}
