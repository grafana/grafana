package queryhistory

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore) *QueryHistoryService {
	return &QueryHistoryService{
		SQLStore: sqlStore,
		cfg:      cfg,
	}
}

type Service interface {
	AddToQueryHistory(ctx context.Context, user *models.SignedInUser, queries *simplejson.Json, datasourceUid string) (*models.QueryHistory, error)
}

type QueryHistoryService struct {
	SQLStore *sqlstore.SQLStore
	cfg      *setting.Cfg
}

func (s QueryHistoryService) AddToQueryHistory(ctx context.Context, user *models.SignedInUser, queries *simplejson.Json, datasourceUid string) (*models.QueryHistory, error) {
	if s.isDisabled() {
		return nil, fmt.Errorf("query history feature is disabled")
	}

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

func (s QueryHistoryService) isDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.QueryHistoryEnabled
}
