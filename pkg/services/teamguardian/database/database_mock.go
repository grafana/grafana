package database

import (
	"context"

	"github.com/stretchr/testify/mock"
)

type TeamGuardianStoreMock struct {
	mock.Mock
}

func (t *TeamGuardianStoreMock) DeleteByUser(ctx context.Context, userID int64) error {
	args := t.Called(ctx, userID)
	return args.Get(0).(error)
}
