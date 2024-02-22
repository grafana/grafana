package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/migration"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type UpgradeSrv struct {
	log            log.Logger
	upgradeService migration.UpgradeService
	cfg            *setting.Cfg
}

func NewUpgradeSrc(
	log log.Logger,
	upgradeService migration.UpgradeService,
	cfg *setting.Cfg,
) *UpgradeSrv {
	return &UpgradeSrv{
		log:            log,
		upgradeService: upgradeService,
		cfg:            cfg,
	}
}

func (srv *UpgradeSrv) RoutePostUpgradeOrg(c *contextmodel.ReqContext) response.Response {
	summary, err := srv.upgradeService.MigrateOrg(c.Req.Context(), c.OrgID, c.QueryBool("skipExisting"))
	if err != nil {
		if errors.Is(err, migration.ErrUpgradeInProgress) {
			return ErrResp(http.StatusConflict, err, "Upgrade already in progress")
		}
		return ErrResp(http.StatusInternalServerError, err, "Server error")
	}
	return response.JSON(http.StatusOK, summary)
}

func (srv *UpgradeSrv) RouteGetOrgUpgrade(c *contextmodel.ReqContext) response.Response {
	state, err := srv.upgradeService.GetOrgMigrationState(c.Req.Context(), c.OrgID)
	if err != nil {
		if errors.Is(err, migration.ErrUpgradeInProgress) {
			return ErrResp(http.StatusConflict, err, "Upgrade already in progress")
		}
		return ErrResp(http.StatusInternalServerError, err, "Server error")
	}
	return response.JSON(http.StatusOK, state)
}

func (srv *UpgradeSrv) RouteDeleteOrgUpgrade(c *contextmodel.ReqContext) response.Response {
	err := srv.upgradeService.RevertOrg(c.Req.Context(), c.OrgID)
	if err != nil {
		if errors.Is(err, migration.ErrUpgradeInProgress) {
			return ErrResp(http.StatusConflict, err, "Upgrade already in progress")
		}
		return ErrResp(http.StatusInternalServerError, err, "Server error")
	}
	return response.JSON(http.StatusOK, util.DynMap{"message": "Grafana Alerting resources deleted for this organization."})
}

func (srv *UpgradeSrv) RoutePostUpgradeAlert(c *contextmodel.ReqContext, dashboardIdParam string, panelIdParam string) response.Response {
	dashboardId, err := strconv.ParseInt(dashboardIdParam, 10, 64)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "failed to parse dashboardId")
	}

	panelId, err := strconv.ParseInt(panelIdParam, 10, 64)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "failed to parse panelId")
	}

	summary, err := srv.upgradeService.MigrateAlert(c.Req.Context(), c.OrgID, dashboardId, panelId)
	if err != nil {
		if errors.Is(err, migration.ErrUpgradeInProgress) {
			return ErrResp(http.StatusConflict, err, "Upgrade already in progress")
		}
		return ErrResp(http.StatusInternalServerError, err, "Server error")
	}
	return response.JSON(http.StatusOK, summary)
}

func (srv *UpgradeSrv) RoutePostUpgradeDashboard(c *contextmodel.ReqContext, dashboardIdParam string) response.Response {
	dashboardId, err := strconv.ParseInt(dashboardIdParam, 10, 64)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "failed to parse dashboardId")
	}

	summary, err := srv.upgradeService.MigrateDashboardAlerts(c.Req.Context(), c.OrgID, dashboardId, c.QueryBool("skipExisting"))
	if err != nil {
		if errors.Is(err, migration.ErrUpgradeInProgress) {
			return ErrResp(http.StatusConflict, err, "Upgrade already in progress")
		}
		return ErrResp(http.StatusInternalServerError, err, "Server error")
	}
	return response.JSON(http.StatusOK, summary)
}

func (srv *UpgradeSrv) RoutePostUpgradeAllDashboards(c *contextmodel.ReqContext) response.Response {
	summary, err := srv.upgradeService.MigrateAllDashboardAlerts(c.Req.Context(), c.OrgID, c.QueryBool("skipExisting"))
	if err != nil {
		if errors.Is(err, migration.ErrUpgradeInProgress) {
			return ErrResp(http.StatusConflict, err, "Upgrade already in progress")
		}
		return ErrResp(http.StatusInternalServerError, err, "Server error")
	}
	return response.JSON(http.StatusOK, summary)
}

func (srv *UpgradeSrv) RoutePostUpgradeChannel(c *contextmodel.ReqContext, channelIdParam string) response.Response {
	channelId, err := strconv.ParseInt(channelIdParam, 10, 64)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "failed to parse channelId")
	}

	summary, err := srv.upgradeService.MigrateChannel(c.Req.Context(), c.OrgID, channelId)
	if err != nil {
		if errors.Is(err, migration.ErrUpgradeInProgress) {
			return ErrResp(http.StatusConflict, err, "Upgrade already in progress")
		}
		return ErrResp(http.StatusInternalServerError, err, "Server error")
	}
	return response.JSON(http.StatusOK, summary)
}

func (srv *UpgradeSrv) RoutePostUpgradeAllChannels(c *contextmodel.ReqContext) response.Response {
	summary, err := srv.upgradeService.MigrateAllChannels(c.Req.Context(), c.OrgID, c.QueryBool("skipExisting"))
	if err != nil {
		if errors.Is(err, migration.ErrUpgradeInProgress) {
			return ErrResp(http.StatusConflict, err, "Upgrade already in progress")
		}
		return ErrResp(http.StatusInternalServerError, err, "Server error")
	}
	return response.JSON(http.StatusOK, summary)
}
