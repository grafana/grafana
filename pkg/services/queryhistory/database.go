package queryhistory

import (
	"context"
	"fmt"
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

func (s QueryHistoryService) searchQueries(ctx context.Context, user *models.SignedInUser, query SearchInQueryHistoryQuery) (QueryHistorySearchResult, error) {
	var dtos []QueryHistoryDTO
	var allQueries []interface{}

	if query.To <= 0 {
		query.To = time.Now().Unix()
	}

	if query.Page <= 0 {
		query.Page = 1
	}

	if query.Limit <= 0 {
		query.Limit = 100
	}

	if query.Sort == "" {
		query.Sort = "time-desc"
	}

	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		dtosBuilder := sqlstore.SQLBuilder{}
		dtosBuilder.Write(`SELECT
			query_history.uid,
			query_history.datasource_uid,
			query_history.created_by,
			query_history.created_at AS created_at,
			query_history.comment,
			query_history.queries,
		`)
		writeStarredSQL(query, s.SQLStore, &dtosBuilder)
		writeFiltersSQL(query, user, s.SQLStore, &dtosBuilder)
		writeSortSQL(query, s.SQLStore, &dtosBuilder)
		writeLimitSQL(query, s.SQLStore, &dtosBuilder)
		writeOffsetSQL(query, s.SQLStore, &dtosBuilder)

		err := session.SQL(dtosBuilder.GetSQLString(), dtosBuilder.GetParams()...).Find(&dtos)
		if err != nil {
			return err
		}

		countBuilder := sqlstore.SQLBuilder{}
		countBuilder.Write(`SELECT
		`)
		writeStarredSQL(query, s.SQLStore, &countBuilder)
		writeFiltersSQL(query, user, s.SQLStore, &countBuilder)
		err = session.SQL(countBuilder.GetSQLString(), countBuilder.GetParams()...).Find(&allQueries)
		return err
	})

	if err != nil {
		return QueryHistorySearchResult{}, err
	}

	response := QueryHistorySearchResult{
		QueryHistory: dtos,
		TotalCount:   len(allQueries),
		Page:         query.Page,
		PerPage:      query.Limit,
	}

	return response, nil
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

func (s QueryHistoryService) migrateQueries(ctx context.Context, user *models.SignedInUser, cmd MigrateQueriesToQueryHistoryCommand) (int, int, error) {
	queryHistories := make([]*QueryHistory, 0, len(cmd.Queries))
	starredQueries := make([]*QueryHistoryStar, 0)

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		for _, query := range cmd.Queries {
			uid := util.GenerateShortUID()
			queryHistories = append(queryHistories, &QueryHistory{
				OrgID:         user.OrgId,
				UID:           uid,
				Queries:       query.Queries,
				DatasourceUID: query.DatasourceUID,
				CreatedBy:     user.UserId,
				CreatedAt:     query.CreatedAt,
				Comment:       query.Comment,
			})

			if query.Starred {
				starredQueries = append(starredQueries, &QueryHistoryStar{
					UserID:   user.UserId,
					QueryUID: uid,
				})
			}
		}

		batchSize := 50
		var err error
		for i := 0; i < len(queryHistories); i += batchSize {
			j := i + batchSize
			if j > len(queryHistories) {
				j = len(queryHistories)
			}
			_, err = session.InsertMulti(queryHistories[i:j])
			if err != nil {
				return err
			}
		}

		for i := 0; i < len(starredQueries); i += batchSize {
			j := i + batchSize
			if j > len(starredQueries) {
				j = len(starredQueries)
			}
			_, err = session.InsertMulti(starredQueries[i:j])
			if err != nil {
				return err
			}
		}
		return err
	})

	if err != nil {
		return 0, 0, fmt.Errorf("failed to migrate query history: %w", err)
	}

	return len(queryHistories), len(starredQueries), nil
}
