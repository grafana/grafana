package snapshotimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/snapshot"
)

type Service struct {
}

func (s Service) Create(ctx context.Context, cmd *snapshot.CreateCmd) (*snapshot.CreateResult, error) {
	//TODO implement me
	panic("implement me")
}

func (s Service) Delete(ctx context.Context, cmd *snapshot.DeleteCmd) error {
	//TODO implement me
	panic("implement me")
}

func (s Service) GetByKey(ctx context.Context, query *snapshot.GetByKeyQuery) (*snapshot.GetResult, error) {
	//TODO implement me
	panic("implement me")
}

func (s Service) List(ctx context.Context, query *snapshot.ListQuery) (*snapshot.ListResult, error) {
	//TODO implement me
	panic("implement me")
}

func (s Service) DeleteExpired(ctx context.Context) (*snapshot.DeleteExpiredResult, error) {
	//TODO implement me
	panic("implement me")
}
