package service

import (
	"context"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
)

type GetterServiceImpl struct {
	store db.DB
}

var _ dashboards.GetterService = (*GetterServiceImpl)(nil)

func ProvideGetterService(store db.DB) dashboards.GetterService {
	return &GetterServiceImpl{store: store}
}

func (g *GetterServiceImpl) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	return database.GetDashboard(ctx, g.store, query)
}

func (g *GetterServiceImpl) GetDashboards(ctx context.Context, query *dashboards.GetDashboardsQuery) ([]*dashboards.Dashboard, error) {
	var ret = make([]*dashboards.Dashboard, 0)
	err := g.store.WithDbSession(ctx, func(sess *db.Session) error {
		if len(query.DashboardIDs) == 0 && len(query.DashboardUIDs) == 0 {
			return dashboards.ErrCommandValidationFailed
		}
		var session *xorm.Session
		if len(query.DashboardIDs) > 0 {
			session = sess.In("id", query.DashboardIDs)
		} else {
			session = sess.In("uid", query.DashboardUIDs)
		}
		if query.OrgID > 0 {
			session = sess.Where("org_id = ?", query.OrgID)
		}

		err := session.Find(&ret)
		return err
	})
	if err != nil {
		return nil, err
	}
	return ret, nil
}
