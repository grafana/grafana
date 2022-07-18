package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/web"
)

type ImportDashboardAPI struct {
	dashboardImportService dashboardimport.Service
	quotaService           QuotaService
	pluginStore            plugins.Store
	ac                     accesscontrol.AccessControl
	entityEventsService    store.EntityEventsService
	logger                 log.Logger
}

func New(dashboardImportService dashboardimport.Service, quotaService QuotaService,
	pluginStore plugins.Store, ac accesscontrol.AccessControl,
	entityEventsService store.EntityEventsService) *ImportDashboardAPI {
	return &ImportDashboardAPI{
		dashboardImportService: dashboardImportService,
		quotaService:           quotaService,
		pluginStore:            pluginStore,
		ac:                     ac,
		entityEventsService:    entityEventsService,
		logger:                 log.New("d"),
	}
}

func (api *ImportDashboardAPI) RegisterAPIEndpoints(routeRegister routing.RouteRegister) {
	authorize := accesscontrol.Middleware(api.ac)
	routeRegister.Group("/api/dashboards", func(route routing.RouteRegister) {
		route.Post(
			"/import",
			authorize(middleware.ReqSignedIn, accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate)),
			routing.Wrap(api.ImportDashboard),
		)
	}, middleware.ReqSignedIn)
}

func (api *ImportDashboardAPI) ImportDashboard(c *models.ReqContext) response.Response {
	req := dashboardimport.ImportDashboardRequest{}
	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if req.PluginId == "" && req.Dashboard == nil {
		return response.Error(http.StatusUnprocessableEntity, "Dashboard must be set", nil)
	}

	limitReached, err := api.quotaService.QuotaReached(c, "dashboard")
	if err != nil {
		return response.Error(500, "failed to get quota", err)
	}

	if limitReached {
		return response.Error(403, "Quota reached", nil)
	}

	req.User = c.SignedInUser
	resp, err := api.dashboardImportService.ImportDashboard(c.Req.Context(), &req)
	if err != nil {
		return apierrors.ToDashboardErrorResponse(c.Req.Context(), api.pluginStore, err)
	}
	if api.entityEventsService != nil {
		if err := api.entityEventsService.SaveEvent(c.Req.Context(), store.SaveEventCmd{
			EntityId:  store.CreateDatabaseEntityId(resp.UID, c.OrgId, store.EntityTypeDashboard),
			EventType: store.EntityEventTypeCreate,
		}); err != nil {
			api.logger.Warn("failed to save dashboard entity event", "uid", resp.UID, "error", err)
		}
	}

	return response.JSON(http.StatusOK, resp)
}

type QuotaService interface {
	QuotaReached(c *models.ReqContext, target string) (bool, error)
}

type quotaServiceFunc func(c *models.ReqContext, target string) (bool, error)

func (fn quotaServiceFunc) QuotaReached(c *models.ReqContext, target string) (bool, error) {
	return fn(c, target)
}
