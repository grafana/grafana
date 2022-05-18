package dashverimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type store interface {
	Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error)
}

type sqlStore struct {
	db db.DB
}

func (s *sqlStore) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error) {
	var version dashver.DashboardVersion
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Where("dashboard_version.dashboard_id=? AND dashboard_version.version=? AND dashboard.org_id=?", query.DashboardID, query.Version, query.OrgID).
			Join("LEFT", "dashboard", `dashboard.id = dashboard_version.dashboard_id`).
			Get(&version)

		if err != nil {
			return err
		}

		if !has {
			return models.ErrDashboardVersionNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &version, nil
}
