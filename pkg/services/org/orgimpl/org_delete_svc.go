package orgimpl

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

type DeletionService struct {
	store            store
	settingsProvider setting.SettingsProvider
	log              log.Logger
	dashSvc          dashboards.DashboardService
	ac               accesscontrol.AccessControl
}

func ProvideDeletionService(db db.DB, settingsProvider setting.SettingsProvider, dashboardService dashboards.DashboardService, ac accesscontrol.AccessControl) (org.DeletionService, error) {
	log := log.New("org deletion service")
	s := &DeletionService{
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
			log:     log,
		},
		settingsProvider: settingsProvider,
		dashSvc:          dashboardService,
		log:              log,
		ac:               ac,
	}

	return s, nil
}

func (s *DeletionService) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	// we need to use a service identity to delete dashboards from the dashboard service (because the currently signed in user
	// has to be signed into a different org to delete another org, and so this will fail the namespace check). While we already
	// do auth checks on the /api layer, since this is available on the service, adding a check here as well to be safe, in case any additional
	// usage is added internally.
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	hasAccess, err := s.ac.Evaluate(ctx, requester, accesscontrol.EvalPermission(accesscontrol.ActionOrgsDelete))
	if err != nil {
		return err
	}
	if !hasAccess {
		return errors.New("access denied to delete org")
	}

	ctx, _ = identity.WithServiceIdentity(ctx, cmd.ID)
	err = s.dashSvc.DeleteAllDashboards(ctx, cmd.ID)
	if err != nil {
		return fmt.Errorf("failed to delete dashboards for org %d: %w", cmd.ID, err)
	}

	return s.store.Delete(ctx, cmd)
}
