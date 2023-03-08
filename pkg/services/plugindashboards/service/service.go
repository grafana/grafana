package service

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	pluginDashboardsManager "github.com/grafana/grafana/pkg/plugins/manager/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
)

func ProvideService(pluginDashboardStore pluginDashboardsManager.FileStore, dashboardPluginService dashboards.PluginService) *Service {
	return &Service{
		pluginDashboardStore:   pluginDashboardStore,
		dashboardPluginService: dashboardPluginService,
		logger:                 log.New("plugindashboards"),
	}
}

type Service struct {
	pluginDashboardStore   pluginDashboardsManager.FileStore
	dashboardPluginService dashboards.PluginService
	logger                 log.Logger
}

func (s Service) ListPluginDashboards(ctx context.Context, req *plugindashboards.ListPluginDashboardsRequest) (*plugindashboards.ListPluginDashboardsResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("req cannot be nil")
	}

	listArgs := &pluginDashboardsManager.ListPluginDashboardFilesArgs{
		PluginID: req.PluginID,
	}
	listResp, err := s.pluginDashboardStore.ListPluginDashboardFiles(ctx, listArgs)
	if err != nil {
		return nil, err
	}

	result := make([]*plugindashboards.PluginDashboard, 0)

	// load current dashboards
	query := dashboards.GetDashboardsByPluginIDQuery{OrgID: req.OrgID, PluginID: req.PluginID}
	queryResult, err := s.dashboardPluginService.GetDashboardsByPluginID(ctx, &query)
	if err != nil {
		return nil, err
	}

	existingMatches := make(map[int64]bool)
	for _, reference := range listResp.FileReferences {
		loadReq := &plugindashboards.LoadPluginDashboardRequest{
			PluginID:  req.PluginID,
			Reference: reference,
		}
		loadResp, err := s.LoadPluginDashboard(ctx, loadReq)
		if err != nil {
			return nil, err
		}

		dashboard := loadResp.Dashboard

		res := &plugindashboards.PluginDashboard{}
		res.UID = dashboard.UID
		res.Reference = reference
		res.PluginId = req.PluginID
		res.Title = dashboard.Title
		res.Revision = dashboard.Data.Get("revision").MustInt64(1)

		// find existing dashboard
		for _, existingDash := range queryResult {
			if existingDash.Slug == dashboard.Slug {
				res.UID = existingDash.UID
				res.DashboardId = existingDash.ID
				res.Imported = true
				res.ImportedUri = "db/" + existingDash.Slug
				res.ImportedUrl = existingDash.GetURL()
				res.ImportedRevision = existingDash.Data.Get("revision").MustInt64(1)
				existingMatches[existingDash.ID] = true
				break
			}
		}

		result = append(result, res)
	}

	// find deleted dashboards
	for _, dash := range queryResult {
		if _, exists := existingMatches[dash.ID]; !exists {
			result = append(result, &plugindashboards.PluginDashboard{
				UID:         dash.UID,
				Slug:        dash.Slug,
				DashboardId: dash.ID,
				Removed:     true,
			})
		}
	}

	return &plugindashboards.ListPluginDashboardsResponse{
		Items: result,
	}, nil
}

func (s Service) LoadPluginDashboard(ctx context.Context, req *plugindashboards.LoadPluginDashboardRequest) (*plugindashboards.LoadPluginDashboardResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("req cannot be nil")
	}

	args := &pluginDashboardsManager.GetPluginDashboardFileContentsArgs{
		PluginID:      req.PluginID,
		FileReference: req.Reference,
	}
	resp, err := s.pluginDashboardStore.GetPluginDashboardFileContents(ctx, args)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err = resp.Content.Close(); err != nil {
			s.logger.Warn("Failed to close plugin dashboard file", "reference", req.Reference, "err", err)
		}
	}()

	data, err := simplejson.NewFromReader(resp.Content)
	if err != nil {
		return nil, err
	}

	return &plugindashboards.LoadPluginDashboardResponse{
		Dashboard: dashboards.NewDashboardFromJson(data),
	}, nil
}

var _ plugindashboards.Service = &Service{}
