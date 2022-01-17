package queryhistory

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

func ProvideService(sqlStore *sqlstore.SQLStore) *QueryHistoryService {
	return &QueryHistoryService{
		SQLStore: sqlStore,
	}
}

type Service interface {
	AddToQueryHistory(ctx context.Context, user *models.SignedInUser, queries string, dataSourceUid string) (*models.QueryHistory, error)
	ListQueryHistory(ctx context.Context, user *models.SignedInUser, dataSourceUids []string, searchString string, sort string) ([]models.QueryHistory, error)
	DeleteQuery(ctx context.Context, user *models.SignedInUser, queryUid string) error
	GetQueryByUid(ctx context.Context, user *models.SignedInUser, queryUid string) (*models.QueryHistory, error)
	UpdateComment(ctx context.Context, user *models.SignedInUser, query *models.QueryHistory, comment string) error
	StarQuery(ctx context.Context, user *models.SignedInUser, queryUid string) error
	UnstarQuery(ctx context.Context, user *models.SignedInUser, queryUid string) error
}

type QueryHistoryService struct {
	SQLStore *sqlstore.SQLStore
}

func (s QueryHistoryService) AddToQueryHistory(ctx context.Context, user *models.SignedInUser, queries string, dataSourceUid string) (*models.QueryHistory, error) {
	queryHistory := models.QueryHistory{
		OrgId:         user.OrgId,
		Uid:           util.GenerateShortUID(),
		Queries:       queries,
		DatasourceUid: dataSourceUid,
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

func (s QueryHistoryService) ListQueryHistory(ctx context.Context, user *models.SignedInUser, dataSourceUids []string, searchString string, sort string) ([]models.QueryHistory, error) {
	var queryHistory []models.QueryHistory
	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		session.Table("query_history")
		session.In("datasource_uid", dataSourceUids)
		session.Where("org_id = ? AND created_by = ? AND queries LIKE ?", user.OrgId, user.UserId, "%"+searchString+"%")
		if sort == "time-desc" {
			session.Desc("created_at")
		} else if sort == "time-asc" {
			session.Asc("created_at")
		}
		err := session.Find(&queryHistory)
		return err
	})

	if err != nil {
		return nil, err
	}

	return queryHistory, nil
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
		QueryUid: util.GenerateShortUID(),
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

var _ Service = &QueryHistoryService{}
