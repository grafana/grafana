package service

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboardimport/api"
	"github.com/grafana/grafana/pkg/services/dashboardimport/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota"
)

func ProvideService(routeRegister routing.RouteRegister,
	quotaService quota.Service,
	pluginDashboardService plugindashboards.Service, pluginStore pluginstore.Store,
	libraryPanelService librarypanels.Service, dashboardService dashboards.DashboardService,
	ac accesscontrol.AccessControl, folderService folder.Service, features featuremgmt.FeatureToggles,
) *ImportDashboardService {
	s := &ImportDashboardService{
		pluginDashboardService: pluginDashboardService,
		dashboardService:       dashboardService,
		libraryPanelService:    libraryPanelService,
		folderService:          folderService,
		features:               features,
	}

	dashboardImportAPI := api.New(s, quotaService, pluginStore, ac)
	dashboardImportAPI.RegisterAPIEndpoints(routeRegister)

	return s
}

type ImportDashboardService struct {
	pluginDashboardService plugindashboards.Service
	dashboardService       dashboards.DashboardService
	libraryPanelService    librarypanels.Service
	folderService          folder.Service
	features               featuremgmt.FeatureToggles
}

func (s *ImportDashboardService) ImportDashboard(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error) {
	var draftDashboard *dashboards.Dashboard
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
		draftDashboard = dashboards.NewDashboardFromJson(req.Dashboard)
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
		elementMap := map[string]any{}
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

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.DashboardImport).Inc()
	// here we need to get FolderId from FolderUID if it present in the request, if both exist, FolderUID would overwrite FolderID
	if req.FolderUid != "" {
		folder, err := s.folderService.Get(ctx, &folder.GetFolderQuery{
			OrgID:        req.User.GetOrgID(),
			UID:          &req.FolderUid,
			SignedInUser: req.User,
		})
		if err != nil {
			return nil, err
		}
		// nolint:staticcheck
		req.FolderId = folder.ID
	} else {
		folder, err := s.folderService.Get(ctx, &folder.GetFolderQuery{
			ID:           &req.FolderId, // nolint:staticcheck
			OrgID:        req.User.GetOrgID(),
			SignedInUser: req.User,
		})
		if err != nil {
			return nil, err
		}
		req.FolderUid = folder.UID
	}

	var userID int64
	if id, err := identity.UserIdentifier(req.User.GetID()); err == nil {
		userID = id
	}

	saveCmd := dashboards.SaveDashboardCommand{
		Dashboard: generatedDash,
		OrgID:     req.User.GetOrgID(),
		UserID:    userID,
		Overwrite: req.Overwrite,
		PluginID:  req.PluginId,
		FolderID:  req.FolderId, // nolint:staticcheck
		FolderUID: req.FolderUid,
	}

	dto := &dashboards.SaveDashboardDTO{
		OrgID:     saveCmd.OrgID,
		Dashboard: saveCmd.GetDashboardModel(),
		Overwrite: saveCmd.Overwrite,
		User:      req.User,
	}

	// nolint:staticcheck
	err = s.libraryPanelService.ImportLibraryPanelsForDashboard(ctx, req.User, libraryElements, generatedDash.Get("panels").MustArray(), req.FolderId, req.FolderUid)
	if err != nil {
		return nil, err
	}

	savedDashboard, err := s.dashboardService.ImportDashboard(ctx, dto)
	if err != nil {
		return nil, err
	}
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.DashboardImport).Inc()

	revision := savedDashboard.Data.Get("revision").MustInt64(0)
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.DashboardImport).Inc()
	return &dashboardimport.ImportDashboardResponse{
		UID:              savedDashboard.UID,
		PluginId:         req.PluginId,
		Title:            savedDashboard.Title,
		Path:             req.Path,
		Revision:         revision,                // only used for plugin version tracking
		FolderId:         savedDashboard.FolderID, // nolint:staticcheck
		FolderUID:        req.FolderUid,
		ImportedUri:      "db/" + savedDashboard.Slug,
		ImportedUrl:      savedDashboard.GetURL(),
		ImportedRevision: revision,
		Imported:         true,
		DashboardId:      savedDashboard.ID,
		Slug:             savedDashboard.Slug,
	}, nil
}
