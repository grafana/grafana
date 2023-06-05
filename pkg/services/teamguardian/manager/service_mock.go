package manager

import (
	"context"

	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/services/user"
)

type TeamGuardianMock struct {
	mock.Mock
	ExpectedError error
}

func NewTeamGuardianMock() *TeamGuardianMock {
	return &TeamGuardianMock{}
}

func (t *TeamGuardianMock) CanAdmin(ctx context.Context, orgId int64, teamId int64, user *user.SignedInUser) error {
	args := t.Called(ctx, orgId, teamId, user)
	return args.Error(0)
}

func (t *TeamGuardianMock) DeleteByUser(ctx context.Context, userID int64) error {
	return t.ExpectedError
}
