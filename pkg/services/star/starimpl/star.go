package starimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store      store
	dashboards dashboards.DashboardService
}

func ProvideService(db db.DB, dashboard dashboards.DashboardService, cfg *setting.Cfg) star.Service {
	if cfg.IsFeatureToggleEnabled("newDBLibrary") {
		return &Service{
			store: &sqlxStore{
				sess: db.GetSqlxSession(),
			},
		}
	}
	return &Service{
		store: &sqlStore{
			db: db,
		},
		dashboards: dashboard,
	}
}

func (s *Service) Add(ctx context.Context, cmd *star.StarDashboardCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	if cmd.DashboardUID != "" {
		id, err := s.getDashboardID(ctx, cmd.DashboardUID)
		if err != nil {
			return err
		}
		cmd.DashboardID = id
	}

	return s.store.Insert(ctx, cmd)
}

func (s *Service) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	if cmd.DashboardUID != "" {
		id, err := s.getDashboardID(ctx, cmd.DashboardUID)
		if err != nil {
			return err
		}
		cmd.DashboardID = id
	}

	return s.store.Delete(ctx, cmd)
}

func (s *Service) IsStarredByUser(ctx context.Context, query *star.IsStarredByUserQuery) (bool, error) {
	if query.DashboardUID != "" {
		id, err := s.getDashboardID(ctx, query.DashboardUID)
		if err != nil {
			return false, err
		}
		query.DashboardID = id
	}

	return s.store.Get(ctx, query)
}

func (s *Service) GetByUser(ctx context.Context, cmd *star.GetUserStarsQuery) (*star.GetUserStarsResult, error) {
	stars, err := s.store.List(ctx, cmd)
	if err != nil {
		return nil, err
	}

	ids := make([]int64, 0, len(stars.UserStars))
	for id := range stars.UserStars {
		ids = append(ids, id)
	}

	query := &models.GetDashboardsQuery{DashboardIds: ids}
	err = s.dashboards.GetDashboards(ctx, query)
	if err != nil {
		return nil, err
	}

	uids := make([]string, 0, len(ids))
	for _, dashboard := range query.Result {
		if dashboard == nil {
			continue
		}
		if dashboard.OrgId != cmd.OrgID {
			delete(stars.UserStars, dashboard.Id)
			continue
		}

		uids = append(uids, dashboard.Uid)
	}
	stars.DashboardUIDs = uids

	return stars, err
}

func (s *Service) DeleteByUser(ctx context.Context, userID int64) error {
	return s.store.DeleteByUser(ctx, userID)
}

func (s *Service) getDashboardID(ctx context.Context, uid string) (int64, error) {
	query := &models.GetDashboardQuery{
		Uid: uid,
	}
	err := s.dashboards.GetDashboard(ctx, query)
	if err != nil {
		return 0, err
	}

	return query.Result.Id, nil
}
