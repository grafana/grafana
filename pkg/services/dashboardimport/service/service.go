package service

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboardimport/api"
	"github.com/grafana/grafana/pkg/services/dashboardimport/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	"github.com/grafana/grafana/pkg/services/quota"
)

func ProvideService(routeRegister routing.RouteRegister,
	quotaService quota.Service,
	pluginDashboardService plugindashboards.Service, pluginStore plugins.Store,
	libraryPanelService librarypanels.Service, dashboardService dashboards.DashboardService,
	ac accesscontrol.AccessControl,
) *ImportDashboardService {
	s := &ImportDashboardService{
		pluginDashboardService: pluginDashboardService,
		dashboardService:       dashboardService,
		libraryPanelService:    libraryPanelService,
	}

	dashboardImportAPI := api.New(s, quotaService, pluginStore, ac)
	dashboardImportAPI.RegisterAPIEndpoints(routeRegister)

	return s
}

type ImportDashboardService struct {
	pluginDashboardService plugindashboards.Service
	dashboardService       dashboards.DashboardService
	libraryPanelService    librarypanels.Service
}

func (s *ImportDashboardService) ImportDashboard(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error) {
	var draftDashboard *models.Dashboard
	if req.PluginId != "" {
		loadReq := &plugindashboards.LoadPluginDashboardRequest{
			PluginID:  req.PluginId,
			Reference: req.Path,
		}
		if resp, err := s.pluginDashboardService.LoadPluginDashboard(ctx, loadReq); err != nil {
			return nil, err
		} else {
			draftDashboard = resp.Dashboard
		}
	} else {
		draftDashboard = models.NewDashboardFromJson(req.Dashboard)
	}

	evaluator := utils.NewDashTemplateEvaluator(draftDashboard.Data, req.Inputs)
	generatedDash, err := evaluator.Eval()
	if err != nil {
		return nil, err
	}

	// Maintain backwards compatibility by transforming array of library elements to map
	libraryElements := generatedDash.Get("__elements")
	libElementsArr, err := libraryElements.Array()
	if err == nil {
		elementMap := map[string]interface{}{}
		for _, el := range libElementsArr {
			libElement := simplejson.NewFromAny(el)
			elementMap[libElement.Get("uid").MustString()] = el
		}
		libraryElements = simplejson.NewFromAny(elementMap)
	}

	// No need to keep these in the stored dashboard JSON
	generatedDash.Del("__elements")
	generatedDash.Del("__inputs")
	generatedDash.Del("__requires")

	saveCmd := models.SaveDashboardCommand{
		Dashboard: generatedDash,
		OrgId:     req.User.OrgID,
		UserId:    req.User.UserID,
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

	savedDashboard, err := s.dashboardService.ImportDashboard(ctx, dto)
	if err != nil {
		return nil, err
	}

	err = s.libraryPanelService.ImportLibraryPanelsForDashboard(ctx, req.User, libraryElements, generatedDash.Get("panels").MustArray(), req.FolderId)
	if err != nil {
		return nil, err
	}

	err = s.libraryPanelService.ConnectLibraryPanelsForDashboard(ctx, req.User, savedDashboard)
	if err != nil {
		return nil, err
	}

	return &dashboardimport.ImportDashboardResponse{
		UID:              savedDashboard.Uid,
		PluginId:         req.PluginId,
		Title:            savedDashboard.Title,
		Path:             req.Path,
		Revision:         savedDashboard.Data.Get("revision").MustInt64(1),
		FolderId:         savedDashboard.FolderId,
		ImportedUri:      "db/" + savedDashboard.Slug,
		ImportedUrl:      savedDashboard.GetUrl(),
		ImportedRevision: savedDashboard.Data.Get("revision").MustInt64(1),
		Imported:         true,
		DashboardId:      savedDashboard.Id,
		Slug:             savedDashboard.Slug,
	}, nil
}
