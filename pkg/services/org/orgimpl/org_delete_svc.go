package orgimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

type DeletionService struct {
	store   store
	cfg     *setting.Cfg
	log     log.Logger
	dashSvc dashboards.DashboardService
}

func ProvideDeletionService(db db.DB, cfg *setting.Cfg, dashboardService dashboards.DashboardService) (org.DeletionService, error) {
	log := log.New("org deletion service")
	s := &DeletionService{
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
			log:     log,
		},
		cfg:     cfg,
		dashSvc: dashboardService,
		log:     log,
	}

	return s, nil
}

func (s *DeletionService) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	err := s.dashSvc.DeleteAllDashboards(ctx, cmd.ID)
	if err != nil {
		return err
	}

	return s.store.Delete(ctx, cmd)
}
