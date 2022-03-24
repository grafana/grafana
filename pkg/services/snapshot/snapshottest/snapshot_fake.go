package snapshottest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/snapshot"
)

type Fake struct {
}

func (f Fake) Create(ctx context.Context, cmd *snapshot.CreateCmd) (*snapshot.CreateResult, error) {
	//TODO implement me
	panic("implement me")
}

func (f Fake) Delete(ctx context.Context, cmd *snapshot.DeleteCmd) error {
	//TODO implement me
	panic("implement me")
}

func (f Fake) GetByKey(ctx context.Context, query *snapshot.GetByKeyQuery) (*snapshot.GetResult, error) {
	//TODO implement me
	panic("implement me")
}

func (f Fake) List(ctx context.Context, query *snapshot.ListQuery) (*snapshot.ListResult, error) {
	//TODO implement me
	panic("implement me")
}

func (f Fake) DeleteExpired(ctx context.Context) (*snapshot.DeleteExpiredResult, error) {
	//TODO implement me
	panic("implement me")
}
