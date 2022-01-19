package queryhistory

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

type QueryHistoryWithStarred struct {
	Starred bool `json:"starred"`
	models.QueryHistory
}

func ProvideService(sqlStore *sqlstore.SQLStore) *QueryHistoryService {
	return &QueryHistoryService{
		SQLStore: sqlStore,
	}
}

type Service interface {
	AddToQueryHistory(ctx context.Context, user *models.SignedInUser, queries string, datasourceUid string) (*models.QueryHistory, error)
	ListQueryHistory(ctx context.Context, user *models.SignedInUser, query *models.QueryHistorySearch) ([]QueryHistoryWithStarred, error)
	ListQueriesBySearchParams(ctx context.Context, user *models.SignedInUser, query *models.QueryHistorySearch) ([]models.QueryHistory, error)
	DeleteQuery(ctx context.Context, user *models.SignedInUser, queryUid string) error
	GetQueryByUid(ctx context.Context, user *models.SignedInUser, queryUid string) (*models.QueryHistory, error)
	UpdateComment(ctx context.Context, user *models.SignedInUser, query *models.QueryHistory, comment string) error
	StarQuery(ctx context.Context, user *models.SignedInUser, queryUid string) error
	UnstarQuery(ctx context.Context, user *models.SignedInUser, queryUid string) error
	ListStarredQueriesByUserId(ctx context.Context, user *models.SignedInUser) ([]string, error)
}

type QueryHistoryService struct {
	SQLStore *sqlstore.SQLStore
}

func (s QueryHistoryService) AddToQueryHistory(ctx context.Context, user *models.SignedInUser, queries string, datasourceUid string) (*models.QueryHistory, error) {
	queryHistory := models.QueryHistory{
		OrgId:         user.OrgId,
		Uid:           util.GenerateShortUID(),
		Queries:       queries,
		DatasourceUid: datasourceUid,
		CreatedBy:     user.UserId,
		CreatedAt:     time.Now().Unix(),
		Comment:       "",
	}

	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		_, err := session.Insert(&queryHistory)
		return err
	})
	if err != nil {
		return nil, err
	}

	return &queryHistory, nil
}

func (s QueryHistoryService) ListQueriesBySearchParams(ctx context.Context, user *models.SignedInUser, query *models.QueryHistorySearch) ([]models.QueryHistory, error) {
	var queryHistory []models.QueryHistory
	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		session.Table("query_history")
		session.In("datasource_uid", query.DatasourceUids)
		session.Where("org_id = ? AND created_by = ? AND queries LIKE ?", user.OrgId, user.UserId, "%"+query.SearchString+"%")
		if query.Sort == "time-asc" {
			session.Asc("created_at")
			// Defaults to time descending
		} else {
			session.Desc("created_at")
		}
		err := session.Find(&queryHistory)
		return err
	})

	if err != nil {
		return nil, err
	}

	return queryHistory, nil
}

func (s QueryHistoryService) ListQueryHistory(ctx context.Context, user *models.SignedInUser, query *models.QueryHistorySearch) ([]QueryHistoryWithStarred, error) {
	if !query.OnlyStarred {
		queryHistory, err := s.ListQueriesBySearchParams(ctx, user, query)
		if err != nil {
			return nil, err
		}

		var starredQueries []string
		starredQueries, err = s.ListStarredQueriesByUserId(ctx, user)
		if err != nil {
			return nil, err
		}

		queries := make([]QueryHistoryWithStarred, 0, len(queryHistory))

		for _, query := range queryHistory {
			index := sort.SearchStrings(starredQueries, query.Uid)
			if index < len(starredQueries) && starredQueries[index] == query.Uid {
				queries = append(queries, QueryHistoryWithStarred{
					Starred:      true,
					QueryHistory: query,
				})
			} else {
				queries = append(queries, QueryHistoryWithStarred{
					Starred:      false,
					QueryHistory: query,
				})
			}
		}
		return queries, nil
	} else {
		var queryHistory []models.QueryHistory
		err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
			sql := `SELECT
				query_history.id,
				query_history.uid,
				query_history.datasource_uid,
				query_history.org_id,
				query_history.created_by,
				query_history.created_at,
				query_history.comment,
				query_history.queries
				FROM query_history
				INNER JOIN query_history_star ON query_history_star.query_uid = query_history.uid
				WHERE query_history.org_id = ? AND query_history.created_by = ? AND query_history.queries LIKE ? AND query_history.datasource_uid IN (?` + strings.Repeat(",?", len(query.DatasourceUids)-1) + `)`

			params := []interface{}{user.OrgId, user.UserId, "%" + query.SearchString + "%"}
			for _, uid := range query.DatasourceUids {
				params = append(params, uid)
			}
			err := session.SQL(sql, params...).Find(&queryHistory)
			return err
		})

		queries := make([]QueryHistoryWithStarred, 0, len(queryHistory))
		for _, query := range queryHistory {
			queries = append(queries, QueryHistoryWithStarred{
				Starred:      true,
				QueryHistory: query,
			})
		}

		return queries, err
	}
}

func (s QueryHistoryService) GetQueryByUid(ctx context.Context, user *models.SignedInUser, queryUid string) (*models.QueryHistory, error) {
	var queryHistory models.QueryHistory

	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		exists, err := session.Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgId, user.UserId, queryUid).Get(&queryHistory)
		if !exists {
			return models.ErrQueryNotFound
		}
		return err
	})

	if err != nil {
		return nil, err
	}

	return &queryHistory, nil
}

func (s QueryHistoryService) DeleteQuery(ctx context.Context, user *models.SignedInUser, queryUid string) error {
	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		id, err := session.Where("org_id = ? AND created_by = ? AND uid = ?", user.OrgId, user.UserId, queryUid).Delete(models.QueryHistory{})
		if id == 0 {
			return models.ErrQueryNotFound
		}
		return err
	})

	if err != nil {
		return err
	}

	return nil
}

func (s QueryHistoryService) UpdateComment(ctx context.Context, user *models.SignedInUser, query *models.QueryHistory, comment string) error {
	query.Comment = comment
	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		_, err := session.ID(query.Id).Update(query)
		return err
	})

	if err != nil {
		return err
	}

	return nil
}

func (s QueryHistoryService) StarQuery(ctx context.Context, user *models.SignedInUser, queryUid string) error {
	starredQuery := models.QueryHistoryStar{
		QueryUid: queryUid,
		UserId:   user.UserId,
	}

	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		_, err := session.Insert(&starredQuery)
		return err
	})
	if err != nil {
		return err
	}

	return nil
}

func (s QueryHistoryService) UnstarQuery(ctx context.Context, user *models.SignedInUser, queryUid string) error {
	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		id, err := session.Where("user_id = ? AND query_uid = ?", user.UserId, queryUid).Delete(models.QueryHistoryStar{})
		if id == 0 {
			return models.ErrStarredQueryNotFound
		}
		return err
	})

	if err != nil {
		return err
	}

	return nil
}

func (s QueryHistoryService) ListStarredQueriesByUserId(ctx context.Context, user *models.SignedInUser) ([]string, error) {
	var starredQueries []string
	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		session.Table("query_history_star")
		session.Where("user_id = ?", user.UserId)
		session.Cols("query_uid")
		session.Asc("query_uid")
		err := session.Find(&starredQueries)
		return err
	})

	if err != nil {
		return nil, err
	}

	return starredQueries, nil
}

var _ Service = &QueryHistoryService{}
