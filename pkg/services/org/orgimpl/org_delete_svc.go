package orgimpl

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgdelete"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

type DeletionService struct {
	store      store
	cfg        *setting.Cfg
	log        log.Logger
	dashSvc    dashboards.DashboardService
	ac         accesscontrol.AccessControl
	k8sDeleter resourceDeleter
}

var _ org.DeletionService = (*DeletionService)(nil)
var _ orgdelete.Registrar = (*DeletionService)(nil)

func ProvideDeletionService(sql legacysql.LegacyDatabaseProvider, cfg *setting.Cfg, dashboardService dashboards.DashboardService, ac accesscontrol.AccessControl, restCfg apiserver.RestConfigProvider) (*DeletionService, error) {
	log := log.New("org deletion service")
	s := &DeletionService{
		store: &sqlStore{
			sql: sql,
			log: log,
		},
		cfg:        cfg,
		dashSvc:    dashboardService,
		log:        log,
		ac:         ac,
		k8sDeleter: newK8sResourceDeleter(cfg, restCfg, log),
	}

	return s, nil
}

func ProvideDeleteRegistrar(service *DeletionService) orgdelete.Registrar {
	return service
}

func (s *DeletionService) RegisterDelete(renderer orgdelete.Renderer) {
	s.store.RegisterDelete(renderer)
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

	// Dashboards a repository manages are closed to the generic service identity:
	// a read-only repository rejects the delete and a writable one has it committed
	// back to Git. Deleting an org must do neither, so the sweep runs as the
	// provisioning identity and writes straight to storage. Not in Cloud, where that
	// identity would resolve to the stack rather than to this org.
	dashboardCtx := ctx
	if s.cfg.StackID == "" {
		provisioningCtx, _, err := identity.WithProvisioningIdentity(ctx, request.GetNamespaceMapper(s.cfg)(cmd.ID))
		if err != nil {
			return fmt.Errorf("failed to build the provisioning identity for org %d: %w", cmd.ID, err)
		}
		dashboardCtx = provisioningCtx
	}
	err = s.dashSvc.DeleteAllDashboards(dashboardCtx, cmd.ID)
	if err != nil {
		return fmt.Errorf("failed to delete dashboards for org %d: %w", cmd.ID, err)
	}

	// Delete migrated resources through the k8s API
	if err := s.k8sDeleter.deleteCollections(ctx, cmd.ID); err != nil {
		return fmt.Errorf("failed to delete migrated resources for org %d: %w", cmd.ID, err)
	}

	return s.store.Delete(ctx, cmd)
}
