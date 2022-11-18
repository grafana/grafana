package loginattemptimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/loginattempt"
)

var _ store = new(fakeStore)

type fakeStore struct {
}

func (f fakeStore) CreateLoginAttempt(ctx context.Context, command *CreateLoginAttemptCommand) error {
	//TODO implement me
	panic("implement me")
}

func (f fakeStore) DeleteOldLoginAttempts(ctx context.Context, command *loginattempt.DeleteOldLoginAttemptsCommand) error {
	//TODO implement me
	panic("implement me")
}

func (f fakeStore) GetUserLoginAttemptCount(ctx context.Context, query *GetUserLoginAttemptCountQuery) error {
	//TODO implement me
	panic("implement me")
}
