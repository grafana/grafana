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
	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		// Try to unstar the query first
		_, err := session.Table("query_history_star").Where("user_id = ? AND query_uid = ?", user.UserId, UID).Delete(QueryHistoryStar{})
		if err != nil {
			s.log.Error("Failed to unstar query while deleting it from query history", "query", UID, "user", user.UserId, "error", err)
		}

		// Then delete it
		id, err := session.Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgId, user.UserId, UID).Delete(QueryHistory{})
		if err != nil {
			return err
		}
		if id == 0 {
			return ErrQueryNotFound
		}

		queryID = id
		return nil
	})

	return queryID, err
}

func (s QueryHistoryService) patchQueryComment(ctx context.Context, user *models.SignedInUser, UID string, cmd PatchQueryCommentInQueryHistoryCommand) (QueryHistoryDTO, error) {
	var queryHistory QueryHistory
	var isStarred bool

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

		starred, err := session.Table("query_history_star").Where("user_id = ? AND query_uid = ?", user.UserId, UID).Exist()
		if err != nil {
			return err
		}
		isStarred = starred
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
		Starred:       isStarred,
	}

	return dto, nil
}

func (s QueryHistoryService) starQuery(ctx context.Context, user *models.SignedInUser, UID string) (QueryHistoryDTO, error) {
	var queryHistory QueryHistory
	var isStarred bool

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		// Check if query exists as we want to star only existing queries
		exists, err := session.Table("query_history").Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgId, user.UserId, UID).Get(&queryHistory)
		if err != nil {
			return err
		}
		if !exists {
			return ErrQueryNotFound
		}

		// If query exists then star it
		queryHistoryStar := QueryHistoryStar{
			UserID:   user.UserId,
			QueryUID: UID,
		}

		_, err = session.Insert(&queryHistoryStar)
		if err != nil {
			if s.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
				return ErrQueryAlreadyStarred
			}
			return err
		}

		isStarred = true
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
		Starred:       isStarred,
	}

	return dto, nil
}

func (s QueryHistoryService) unstarQuery(ctx context.Context, user *models.SignedInUser, UID string) (QueryHistoryDTO, error) {
	var queryHistory QueryHistory
	var isStarred bool

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		exists, err := session.Table("query_history").Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgId, user.UserId, UID).Get(&queryHistory)
		if err != nil {
			return err
		}
		if !exists {
			return ErrQueryNotFound
		}

		id, err := session.Table("query_history_star").Where("user_id = ? AND query_uid = ?", user.UserId, UID).Delete(QueryHistoryStar{})
		if id == 0 {
			return ErrStarredQueryNotFound
		}
		if err != nil {
			return err
		}

		isStarred = false
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
		Starred:       isStarred,
	}

	return dto, nil
}
