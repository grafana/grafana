package database

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type TeamGuardianStoreImpl struct{}

func ProvideTeamGuardianStore() *TeamGuardianStoreImpl {
	return &TeamGuardianStoreImpl{}
}

func (t *TeamGuardianStoreImpl) GetTeamMembers(ctx context.Context, query models.GetTeamMembersQuery) ([]*models.TeamMemberDTO, error) {
	if err := sqlstore.GetTeamMembers(ctx, &query); err != nil {
		return nil, err
	}

	return query.Result, nil
}
