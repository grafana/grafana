package api

import (
	"context"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type UpgradeService interface {
	MigrateAlert(ctx context.Context, orgID int64, dashboardID int64, panelID int64, replace bool) (migmodels.OrgMigrationSummary, error)
	MigrateDashboardAlerts(ctx context.Context, orgID int64, dashboardID int64, replace bool) (migmodels.OrgMigrationSummary, error)
	MigrateAllDashboardAlerts(ctx context.Context, orgID int64, replace bool) (migmodels.OrgMigrationSummary, error)
	MigrateChannel(ctx context.Context, orgID int64, channelID int64, replace bool) (migmodels.OrgMigrationSummary, error)
	MigrateAllChannels(ctx context.Context, orgID int64, replace bool) (migmodels.OrgMigrationSummary, error)
	MigrateOrg(ctx context.Context, orgID int64, replace bool) (migmodels.OrgMigrationSummary, error)
	GetOrgMigrationState(ctx context.Context, orgID int64) (*migmodels.OrgMigrationState, error)
	RevertOrg(ctx context.Context, orgID int64) error
}

type UpgradeSrv struct {
	log            log.Logger
	upgradeService UpgradeService
	cfg            *setting.Cfg
}

func NewUpgradeSrc(
	log log.Logger,
	upgradeService UpgradeService,
	cfg *setting.Cfg,
) *UpgradeSrv {
	return &UpgradeSrv{
		log:            log,
		upgradeService: upgradeService,
		cfg:            cfg,
	}
}

func (srv *UpgradeSrv) RoutePostUpgradeOrg(c *contextmodel.ReqContext) response.Response {
	// If UA is enabled, we don't want to allow the user to use this endpoint to upgrade anymore.
	if srv.cfg.UnifiedAlerting.IsEnabled() {
		return response.Error(http.StatusForbidden, "This endpoint is not available with UA enabled.", nil)
	}

	summary, err := srv.upgradeService.MigrateOrg(c.Req.Context(), c.OrgID, c.QueryBool("skipExisting"))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Server error", err)
	}
	//return response.JSON(http.StatusOK, util.DynMap{"message": "Grafana Alerting resources created based on existing alerts and notification channels."})
	return response.JSON(http.StatusOK, FromOrgMigrationSummary(summary))
}

func (srv *UpgradeSrv) RouteGetOrgUpgrade(c *contextmodel.ReqContext) response.Response {
	// If UA is enabled, we don't want to allow the user to use this endpoint to upgrade anymore.
	if srv.cfg.UnifiedAlerting.IsEnabled() {
		return response.Error(http.StatusForbidden, "This endpoint is not available with UA enabled.", nil)
	}

	state, err := srv.upgradeService.GetOrgMigrationState(c.Req.Context(), c.OrgID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Server error", err)
	}
	return response.JSON(http.StatusOK, FromMigrationState(state))
}

func (srv *UpgradeSrv) RouteDeleteOrgUpgrade(c *contextmodel.ReqContext) response.Response {
	// If UA is enabled, we don't want to allow the user to use this endpoint to upgrade anymore.
	if srv.cfg.UnifiedAlerting.IsEnabled() {
		return response.Error(http.StatusForbidden, "This endpoint is not available with UA enabled.", nil)
	}

	err := srv.upgradeService.RevertOrg(c.Req.Context(), c.OrgID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Server error", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{"message": "Grafana Alerting resources deleted for this organization."})
}

func (srv *UpgradeSrv) RoutePostUpgradeAlert(c *contextmodel.ReqContext, dashboardIdParam string, panelIdParam string) response.Response {
	// If UA is enabled, we don't want to allow the user to use this endpoint to upgrade anymore.
	if srv.cfg.UnifiedAlerting.IsEnabled() {
		return response.Error(http.StatusForbidden, "This endpoint is not available with UA enabled.", nil)
	}

	dashboardId, err := strconv.ParseInt(dashboardIdParam, 10, 64)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "failed to parse dashboardId")
	}

	panelId, err := strconv.ParseInt(panelIdParam, 10, 64)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "failed to parse panelId")
	}

	summary, err := srv.upgradeService.MigrateAlert(c.Req.Context(), c.OrgID, dashboardId, panelId, c.QueryBool("skipExisting"))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Server error", err)
	}
	return response.JSON(http.StatusOK, FromOrgMigrationSummary(summary))
}

func (srv *UpgradeSrv) RoutePostUpgradeDashboard(c *contextmodel.ReqContext, dashboardIdParam string) response.Response {
	// If UA is enabled, we don't want to allow the user to use this endpoint to upgrade anymore.
	if srv.cfg.UnifiedAlerting.IsEnabled() {
		return response.Error(http.StatusForbidden, "This endpoint is not available with UA enabled.", nil)
	}

	dashboardId, err := strconv.ParseInt(dashboardIdParam, 10, 64)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "failed to parse dashboardId")
	}

	summary, err := srv.upgradeService.MigrateDashboardAlerts(c.Req.Context(), c.OrgID, dashboardId, c.QueryBool("skipExisting"))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Server error", err)
	}
	return response.JSON(http.StatusOK, FromOrgMigrationSummary(summary))
}

func (srv *UpgradeSrv) RoutePostUpgradeAllDashboards(c *contextmodel.ReqContext) response.Response {
	// If UA is enabled, we don't want to allow the user to use this endpoint to upgrade anymore.
	if srv.cfg.UnifiedAlerting.IsEnabled() {
		return response.Error(http.StatusForbidden, "This endpoint is not available with UA enabled.", nil)
	}

	summary, err := srv.upgradeService.MigrateAllDashboardAlerts(c.Req.Context(), c.OrgID, c.QueryBool("skipExisting"))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Server error", err)
	}
	return response.JSON(http.StatusOK, FromOrgMigrationSummary(summary))
}

func (srv *UpgradeSrv) RoutePostUpgradeChannel(c *contextmodel.ReqContext, channelIdParam string) response.Response {
	// If UA is enabled, we don't want to allow the user to use this endpoint to upgrade anymore.
	if srv.cfg.UnifiedAlerting.IsEnabled() {
		return response.Error(http.StatusForbidden, "This endpoint is not available with UA enabled.", nil)
	}

	channelId, err := strconv.ParseInt(channelIdParam, 10, 64)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "failed to parse channelId")
	}

	summary, err := srv.upgradeService.MigrateChannel(c.Req.Context(), c.OrgID, channelId, c.QueryBool("skipExisting"))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Server error", err)
	}
	return response.JSON(http.StatusOK, FromOrgMigrationSummary(summary))
}

func (srv *UpgradeSrv) RoutePostUpgradeAllChannels(c *contextmodel.ReqContext) response.Response {
	// If UA is enabled, we don't want to allow the user to use this endpoint to upgrade anymore.
	if srv.cfg.UnifiedAlerting.IsEnabled() {
		return response.Error(http.StatusForbidden, "This endpoint is not available with UA enabled.", nil)
	}

	summary, err := srv.upgradeService.MigrateAllChannels(c.Req.Context(), c.OrgID, c.QueryBool("skipExisting"))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Server error", err)
	}
	return response.JSON(http.StatusOK, FromOrgMigrationSummary(summary))
}
