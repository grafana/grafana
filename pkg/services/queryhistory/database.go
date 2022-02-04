package queryhistory

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

func (s QueryHistoryService) createQuery(ctx context.Context, user *models.SignedInUser, cmd CreateQueryInQueryHistoryCommand) error {
	queryHistory := QueryHistory{
		OrgId:         user.OrgId,
		Uid:           util.GenerateShortUID(),
		Queries:       cmd.Queries,
		DatasourceUid: cmd.DatasourceUid,
		CreatedBy:     user.UserId,
		CreatedAt:     time.Now().Unix(),
		Comment:       "",
	}

	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		_, err := session.Insert(&queryHistory)
		return err
	})
	if err != nil {
		return err
	}

	return nil
}
