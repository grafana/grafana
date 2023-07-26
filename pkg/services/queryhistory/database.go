package queryhistory

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

// createQuery adds a query into query history
func (s QueryHistoryService) createQuery(ctx context.Context, user *user.SignedInUser, cmd CreateQueryInQueryHistoryCommand) (QueryHistoryDTO, error) {
	queryHistory := QueryHistory{
		OrgID:         user.OrgID,
		UID:           util.GenerateShortUID(),
		Queries:       cmd.Queries,
		DatasourceUID: cmd.DatasourceUID,
		CreatedBy:     user.UserID,
		CreatedAt:     s.now().Unix(),
		Comment:       "",
	}

	err := s.store.WithDbSession(ctx, func(session *db.Session) error {
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

// searchQueries searches for queries in query history based on provided parameters
func (s QueryHistoryService) searchQueries(ctx context.Context, user *user.SignedInUser, query SearchInQueryHistoryQuery) (QueryHistorySearchResult, error) {
	var dtos []QueryHistoryDTO
	var allQueries []interface{}

	if query.To <= 0 {
		query.To = s.now().Unix()
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

	err := s.store.WithDbSession(ctx, func(session *db.Session) error {
		dtosBuilder := db.SQLBuilder{}
		dtosBuilder.Write(`SELECT
			query_history.uid,
			query_history.datasource_uid,
			query_history.created_by,
			query_history.created_at AS created_at,
			query_history.comment,
			query_history.queries,
		`)
		writeStarredSQL(query, s.store, &dtosBuilder)
		writeFiltersSQL(query, user, s.store, &dtosBuilder)
		writeSortSQL(query, s.store, &dtosBuilder)
		writeLimitSQL(query, s.store, &dtosBuilder)
		writeOffsetSQL(query, s.store, &dtosBuilder)

		err := session.SQL(dtosBuilder.GetSQLString(), dtosBuilder.GetParams()...).Find(&dtos)
		if err != nil {
			return err
		}

		countBuilder := db.SQLBuilder{}
		countBuilder.Write(`SELECT
		`)
		writeStarredSQL(query, s.store, &countBuilder)
		writeFiltersSQL(query, user, s.store, &countBuilder)
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

func (s QueryHistoryService) deleteQuery(ctx context.Context, user *user.SignedInUser, UID string) (int64, error) {
	var queryID int64
	err := s.store.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		// Try to unstar the query first
		_, err := session.Table("query_history_star").Where("user_id = ? AND query_uid = ?", user.UserID, UID).Delete(QueryHistoryStar{})
		if err != nil {
			s.log.Error("Failed to unstar query while deleting it from query history", "query", UID, "user", user.UserID, "error", err)
		}

		// Then delete it
		id, err := session.Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgID, user.UserID, UID).Delete(QueryHistory{})
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

// patchQueryComment searches updates comment for query in query history
func (s QueryHistoryService) patchQueryComment(ctx context.Context, user *user.SignedInUser, UID string, cmd PatchQueryCommentInQueryHistoryCommand) (QueryHistoryDTO, error) {
	var queryHistory QueryHistory
	var isStarred bool

	err := s.store.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		exists, err := session.Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgID, user.UserID, UID).Get(&queryHistory)
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

		starred, err := session.Table("query_history_star").Where("user_id = ? AND query_uid = ?", user.UserID, UID).Exist()
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

// starQuery adds query into query_history_star table together with user_id and org_id
func (s QueryHistoryService) starQuery(ctx context.Context, user *user.SignedInUser, UID string) (QueryHistoryDTO, error) {
	var queryHistory QueryHistory
	var isStarred bool

	err := s.store.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		// Check if query exists as we want to star only existing queries
		exists, err := session.Table("query_history").Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgID, user.UserID, UID).Get(&queryHistory)
		if err != nil {
			return err
		}
		if !exists {
			return ErrQueryNotFound
		}

		// If query exists then star it
		queryHistoryStar := QueryHistoryStar{
			UserID:   user.UserID,
			QueryUID: UID,
		}

		_, err = session.Insert(&queryHistoryStar)
		if err != nil {
			if s.store.GetDialect().IsUniqueConstraintViolation(err) {
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

// unstarQuery deletes query with with user_id and org_id from query_history_star table
func (s QueryHistoryService) unstarQuery(ctx context.Context, user *user.SignedInUser, UID string) (QueryHistoryDTO, error) {
	var queryHistory QueryHistory
	var isStarred bool

	err := s.store.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		exists, err := session.Table("query_history").Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgID, user.UserID, UID).Get(&queryHistory)
		if err != nil {
			return err
		}
		if !exists {
			return ErrQueryNotFound
		}

		id, err := session.Table("query_history_star").Where("user_id = ? AND query_uid = ?", user.UserID, UID).Delete(QueryHistoryStar{})
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

func (s QueryHistoryService) deleteStaleQueries(ctx context.Context, olderThan int64) (int, error) {
	var rowsCount int64

	err := s.store.WithDbSession(ctx, func(session *db.Session) error {
		sql := `DELETE 
			FROM query_history 
			WHERE uid IN (
				SELECT uid FROM (
					SELECT uid FROM query_history
					LEFT JOIN query_history_star
					ON query_history_star.query_uid = query_history.uid
					WHERE query_history_star.query_uid IS NULL
					AND query_history.created_at <= ?
					ORDER BY query_history.id ASC
					LIMIT 10000
				) AS q
			)`

		res, err := session.Exec(sql, strconv.FormatInt(olderThan, 10))
		if err != nil {
			return err
		}

		rowsCount, err = res.RowsAffected()
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return 0, err
	}

	return int(rowsCount), nil
}

// enforceQueryHistoryRowLimit is run in scheduled cleanup and it removes queries and stars that exceeded limit
func (s QueryHistoryService) enforceQueryHistoryRowLimit(ctx context.Context, limit int, starredQueries bool) (int, error) {
	var deletedRowsCount int64

	err := s.store.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		var rowsCount int64
		var err error
		if starredQueries {
			rowsCount, err = session.Table("query_history_star").Count(QueryHistoryStar{})
		} else {
			rowsCount, err = session.Table("query_history").Count(QueryHistory{})
		}

		if err != nil {
			return err
		}

		countRowsToDelete := rowsCount - int64(limit)
		if countRowsToDelete > 0 {
			var sql string
			if starredQueries {
				sql = `DELETE FROM query_history_star 
					WHERE id IN (
						SELECT id FROM (
							SELECT id FROM query_history_star
							ORDER BY id ASC 
							LIMIT ?
						) AS q
					)`
			} else {
				sql = `DELETE 
					FROM query_history 
					WHERE uid IN (
						SELECT uid FROM (
							SELECT uid FROM query_history
							LEFT JOIN query_history_star
							ON query_history_star.query_uid = query_history.uid
							WHERE query_history_star.query_uid IS NULL
							ORDER BY query_history.id ASC
							LIMIT ?
						) AS q
					)`
			}

			sqlLimit := countRowsToDelete
			if sqlLimit > 10000 {
				sqlLimit = 10000
			}

			res, err := session.Exec(sql, strconv.FormatInt(sqlLimit, 10))
			if err != nil {
				return err
			}

			deletedRowsCount, err = res.RowsAffected()
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}

	return int(deletedRowsCount), nil
}
