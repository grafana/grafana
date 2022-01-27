package service

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboardimport/api"
	"github.com/grafana/grafana/pkg/services/dashboardimport/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/schemaloader"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideService(sqlStore *sqlstore.SQLStore, routeRegister routing.RouteRegister,
	quotaService *quota.QuotaService, schemaLoaderService *schemaloader.SchemaLoaderService,
	pluginDashboardManager plugins.PluginDashboardManager, pluginStore plugins.Store,
	libraryPanelService librarypanels.Service) *ImportDashboardService {
	s := &ImportDashboardService{
		pluginDashboardManager: pluginDashboardManager,
		dashboardService:       dashboards.NewService(sqlStore),
		libraryPanelService:    libraryPanelService,
	}

	dashboardImportAPI := api.New(s, quotaService, schemaLoaderService, pluginStore)
	dashboardImportAPI.RegisterAPIEndpoints(routeRegister)

	return s
}

type ImportDashboardService struct {
	pluginDashboardManager plugins.PluginDashboardManager
	dashboardService       dashboards.DashboardService
	libraryPanelService    librarypanels.Service
}

func (s *ImportDashboardService) ImportDashboard(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error) {
	var dashboard *models.Dashboard
	if req.PluginId != "" {
		var err error
		if dashboard, err = s.pluginDashboardManager.LoadPluginDashboard(ctx, req.PluginId, req.Path); err != nil {
			return nil, err
		}
	} else {
		dashboard = models.NewDashboardFromJson(req.Dashboard)
	}

	evaluator := utils.NewDashTemplateEvaluator(dashboard.Data, req.Inputs)
	generatedDash, err := evaluator.Eval()
	if err != nil {
		return nil, err
	}

	saveCmd := models.SaveDashboardCommand{
		Dashboard: generatedDash,
		OrgId:     req.User.OrgId,
		UserId:    req.User.UserId,
		Overwrite: req.Overwrite,
		PluginId:  req.PluginId,
		FolderId:  req.FolderId,
	}

	dto := &dashboards.SaveDashboardDTO{
		OrgId:     saveCmd.OrgId,
		Dashboard: saveCmd.GetDashboardModel(),
		Overwrite: saveCmd.Overwrite,
		User:      req.User,
	}

	savedDash, err := s.dashboardService.ImportDashboard(ctx, dto)
	if err != nil {
		return nil, err
	}

	err = s.libraryPanelService.ImportLibraryPanelsForDashboard(ctx, req.User, savedDash, req.FolderId)
	if err != nil {
		return nil, err
	}

	err = s.libraryPanelService.ConnectLibraryPanelsForDashboard(ctx, req.User, dashboard)
	if err != nil {
		return nil, err
	}

	return &dashboardimport.ImportDashboardResponse{
		UID:              savedDash.Uid,
		PluginId:         req.PluginId,
		Title:            savedDash.Title,
		Path:             req.Path,
		Revision:         savedDash.Data.Get("revision").MustInt64(1),
		FolderId:         savedDash.FolderId,
		ImportedUri:      "db/" + savedDash.Slug,
		ImportedUrl:      savedDash.GetUrl(),
		ImportedRevision: dashboard.Data.Get("revision").MustInt64(1),
		Imported:         true,
		DashboardId:      savedDash.Id,
		Slug:             savedDash.Slug,
	}, nil
}
