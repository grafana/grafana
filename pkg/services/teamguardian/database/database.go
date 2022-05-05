package database

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type TeamGuardianStoreImpl struct {
	sqlStore sqlstore.Store
}

func ProvideTeamGuardianStore(sqlStore sqlstore.Store) *TeamGuardianStoreImpl {
	return &TeamGuardianStoreImpl{sqlStore: sqlStore}
}

func (t *TeamGuardianStoreImpl) GetTeamMembers(ctx context.Context, query models.GetTeamMembersQuery) ([]*models.TeamMemberDTO, error) {
	if err := t.sqlStore.GetTeamMembers(ctx, &query); err != nil {
		return nil, err
	}

	return query.Result, nil
}
