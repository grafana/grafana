package service

import (
	"context"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

type GetterServiceImpl struct {
	store db.DB
}

var _ dashboards.GetterService = (*GetterServiceImpl)(nil)

func ProvideGetterService(store db.DB) dashboards.GetterService {
	return &GetterServiceImpl{store: store}
}

func (g *GetterServiceImpl) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	var queryResult *dashboards.Dashboard
	err := g.store.WithDbSession(ctx, func(sess *db.Session) error {
		if query.ID == 0 && len(query.Slug) == 0 && len(query.UID) == 0 {
			return dashboards.ErrDashboardIdentifierNotSet
		}

		dashboard := dashboards.Dashboard{Slug: query.Slug, OrgID: query.OrgID, ID: query.ID, UID: query.UID}
		has, err := sess.Get(&dashboard)

		if err != nil {
			return err
		} else if !has {
			return dashboards.ErrDashboardNotFound
		}

		dashboard.SetID(dashboard.ID)
		dashboard.SetUID(dashboard.UID)
		queryResult = &dashboard
		return nil
	})

	return queryResult, err
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
