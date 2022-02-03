package database

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type TeamGuardianStoreImpl struct {
	sqlStore *sqlstore.SQLStore
}

func ProvideTeamGuardianStore(sqlStore *sqlstore.SQLStore) *TeamGuardianStoreImpl {
	return &TeamGuardianStoreImpl{sqlStore: sqlStore}
}

func (t *TeamGuardianStoreImpl) GetFilteredTeamMembers(ctx context.Context, query models.GetTeamMembersQuery) ([]*models.TeamMemberDTO, error) {
	if err := t.sqlStore.GetFilteredTeamMembers(ctx, &query); err != nil {
		return nil, err
	}

	return query.Result, nil
}
