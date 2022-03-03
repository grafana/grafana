package service

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboardimport/api"
	"github.com/grafana/grafana/pkg/services/dashboardimport/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/schemaloader"
)

func ProvideService(routeRegister routing.RouteRegister,
	quotaService *quota.QuotaService, schemaLoaderService *schemaloader.SchemaLoaderService,
	pluginDashboardManager plugins.PluginDashboardManager, pluginStore plugins.Store,
	libraryPanelService librarypanels.Service, dashboardService dashboards.DashboardService,
	ac accesscontrol.AccessControl, permissionsServices accesscontrol.PermissionsServices, features featuremgmt.FeatureToggles,
) *ImportDashboardService {
	s := &ImportDashboardService{
		features:                    features,
		pluginDashboardManager:      pluginDashboardManager,
		dashboardService:            dashboardService,
		libraryPanelService:         libraryPanelService,
		dashboardPermissionsService: permissionsServices.GetDashboardService(),
	}

	dashboardImportAPI := api.New(s, quotaService, schemaLoaderService, pluginStore, ac)
	dashboardImportAPI.RegisterAPIEndpoints(routeRegister)

	return s
}

type ImportDashboardService struct {
	features                    featuremgmt.FeatureToggles
	pluginDashboardManager      plugins.PluginDashboardManager
	dashboardService            dashboards.DashboardService
	libraryPanelService         librarypanels.Service
	dashboardPermissionsService accesscontrol.PermissionsService
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

	if s.features.IsEnabled(featuremgmt.FlagAccesscontrol) {
		if err := s.setDashboardPermissions(ctx, req.User, savedDash); err != nil {
			return nil, err
		}
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

func (s *ImportDashboardService) setDashboardPermissions(ctx context.Context, user *models.SignedInUser, dashboard *models.Dashboard) error {
	resourceID := strconv.FormatInt(dashboard.Id, 10)

	permissions := []accesscontrol.SetResourcePermissionCommand{
		{UserID: user.UserId, Permission: models.PERMISSION_ADMIN.String()},
	}

	if dashboard.FolderId == 0 {
		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(models.ROLE_EDITOR), Permission: models.PERMISSION_EDIT.String()},
			{BuiltinRole: string(models.ROLE_VIEWER), Permission: models.PERMISSION_VIEW.String()},
		}...)
	}
	_, err := s.dashboardPermissionsService.SetPermissions(ctx, user.OrgId, resourceID, permissions...)
	if err != nil {
		return err
	}

	return nil
}
