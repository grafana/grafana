package queryhistory

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

func (s QueryHistoryService) createQuery(ctx context.Context, user *models.SignedInUser, cmd CreateQueryInQueryHistoryCommand) (QueryHistoryDTO, error) {
	queryHistory := QueryHistory{
		OrgID:         user.OrgId,
		UID:           util.GenerateShortUID(),
		Queries:       cmd.Queries,
		DatasourceUID: cmd.DatasourceUID,
		CreatedBy:     user.UserId,
		CreatedAt:     time.Now().Unix(),
		Comment:       "",
	}

	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		_, err := session.Insert(&queryHistory)
		return err
	})
	if err != nil {
		return QueryHistoryDTO{}, err
	}

	dto := QueryHistoryDTO{
		UID:           queryHistory.UID,
		DatasourceUID: queryHistory.DatasourceUID,
		CreatedBy:     queryHistory.CreatedBy,
		CreatedAt:     queryHistory.CreatedAt,
		Comment:       queryHistory.Comment,
		Queries:       queryHistory.Queries,
		Starred:       false,
	}

	return dto, nil
}

func (s QueryHistoryService) deleteQuery(ctx context.Context, user *models.SignedInUser, UID string) (int64, error) {
	var queryID int64
	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		id, err := session.Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgId, user.UserId, UID).Delete(QueryHistory{})
		if id == 0 {
			return ErrQueryNotFound
		}
		queryID = id
		return err
	})

	return queryID, err
}

func (s QueryHistoryService) patchQueryComment(ctx context.Context, user *models.SignedInUser, UID string, cmd PatchQueryCommentInQueryHistoryCommand) (QueryHistoryDTO, error) {
	var queryHistory QueryHistory
	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		exists, err := session.Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgId, user.UserId, UID).Get(&queryHistory)
		if err != nil {
			return err
		}
		if !exists {
			return ErrQueryNotFound
		}

		queryHistory.Comment = cmd.Comment
		_, err = session.ID(queryHistory.ID).Update(queryHistory)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return QueryHistoryDTO{}, err
	}

	dto := QueryHistoryDTO{
		UID:           queryHistory.UID,
		DatasourceUID: queryHistory.DatasourceUID,
		CreatedBy:     queryHistory.CreatedBy,
		CreatedAt:     queryHistory.CreatedAt,
		Comment:       queryHistory.Comment,
		Queries:       queryHistory.Queries,
		Starred:       false,
	}

	return dto, nil
}
