package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/mock"
)

type TeamGuardianMock struct {
	mock.Mock
}

func (t *TeamGuardianMock) CanAdmin(ctx context.Context, orgId int64, teamId int64, user *models.SignedInUser) error {
	args := t.Called(ctx, orgId, teamId, user)
	return args.Error(0)
}
