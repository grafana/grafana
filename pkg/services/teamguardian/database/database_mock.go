package database

import (
	"context"

	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/services/team"
)

type TeamGuardianStoreMock struct {
	mock.Mock
}

func (t *TeamGuardianStoreMock) GetTeamMembers(ctx context.Context, query team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	args := t.Called(ctx, query)
	return args.Get(0).([]*team.TeamMemberDTO), args.Error(1)
}

func (t *TeamGuardianStoreMock) DeleteByUser(ctx context.Context, userID int64) error {
	args := t.Called(ctx, userID)
	return args.Get(0).(error)
}
