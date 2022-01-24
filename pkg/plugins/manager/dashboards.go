package manager

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/util"
)

func (m *PluginManager) GetPluginDashboards(ctx context.Context, orgID int64, pluginID string) ([]*plugins.PluginDashboardInfoDTO, error) {
	plugin, exists := m.Plugin(ctx, pluginID)
	if !exists {
		return nil, plugins.NotFoundError{PluginID: pluginID}
	}

	result := make([]*plugins.PluginDashboardInfoDTO, 0)

	// load current dashboards
	query := models.GetDashboardsByPluginIdQuery{OrgId: orgID, PluginId: pluginID}
	if err := bus.Dispatch(ctx, &query); err != nil {
		return nil, err
	}

	existingMatches := make(map[int64]bool)
	for _, include := range plugin.Includes {
		if include.Type != plugins.TypeDashboard {
			continue
		}

		dashboard, err := m.LoadPluginDashboard(ctx, plugin.ID, include.Path)
		if err != nil {
			return nil, err
		}

		res := &plugins.PluginDashboardInfoDTO{}
		res.UID = dashboard.Uid
		res.Path = include.Path
		res.PluginId = plugin.ID
		res.Title = dashboard.Title
		res.Revision = dashboard.Data.Get("revision").MustInt64(1)

		// find existing dashboard
		for _, existingDash := range query.Result {
			if existingDash.Slug == dashboard.Slug {
				res.UID = existingDash.Uid
				res.DashboardId = existingDash.Id
				res.Imported = true
				res.ImportedUri = "db/" + existingDash.Slug
				res.ImportedUrl = existingDash.GetUrl()
				res.ImportedRevision = existingDash.Data.Get("revision").MustInt64(1)
				existingMatches[existingDash.Id] = true
			}
		}

		result = append(result, res)
	}

	// find deleted dashboards
	for _, dash := range query.Result {
		if _, exists := existingMatches[dash.Id]; !exists {
			result = append(result, &plugins.PluginDashboardInfoDTO{
				UID:         dash.Uid,
				Slug:        dash.Slug,
				DashboardId: dash.Id,
				Removed:     true,
			})
		}
	}

	return result, nil
}

func (m *PluginManager) LoadPluginDashboard(ctx context.Context, pluginID, path string) (*models.Dashboard, error) {
	if len(strings.TrimSpace(pluginID)) == 0 {
		return nil, fmt.Errorf("pluginID cannot be empty")
	}

	if len(strings.TrimSpace(path)) == 0 {
		return nil, fmt.Errorf("path cannot be empty")
	}

	plugin, exists := m.Plugin(ctx, pluginID)
	if !exists {
		return nil, plugins.NotFoundError{PluginID: pluginID}
	}

	cleanPath, err := util.CleanRelativePath(path)
	if err != nil {
		// CleanRelativePath should clean and make the path relative so this is not expected to fail
		return nil, err
	}

	dashboardFilePath := filepath.Join(plugin.PluginDir, cleanPath)

	included := false
	for _, include := range plugin.DashboardIncludes() {
		if filepath.Join(plugin.PluginDir, include.Path) == dashboardFilePath {
			included = true
			break
		}
	}

	if !included {
		return nil, fmt.Errorf("dashboard not included in plugin")
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `plugin.PluginDir` is based
	// on plugin folder structure on disk and not user input. `path` input validation above
	// should only allow paths defined in the plugin's plugin.json.
	reader, err := os.Open(dashboardFilePath)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := reader.Close(); err != nil {
			m.log.Warn("Failed to close file", "path", dashboardFilePath, "err", err)
		}
	}()

	data, err := simplejson.NewFromReader(reader)
	if err != nil {
		return nil, err
	}

	return models.NewDashboardFromJson(data), nil
}

func (m *PluginManager) ImportDashboard(ctx context.Context, pluginID, path string, orgID, folderID int64, dashboardModel *simplejson.Json,
	overwrite bool, inputs []plugins.ImportDashboardInput, user *models.SignedInUser) (plugins.PluginDashboardInfoDTO,
	*models.Dashboard, error) {
	var dashboard *models.Dashboard
	if pluginID != "" {
		var err error
		if dashboard, err = m.LoadPluginDashboard(ctx, pluginID, path); err != nil {
			return plugins.PluginDashboardInfoDTO{}, &models.Dashboard{}, err
		}
	} else {
		dashboard = models.NewDashboardFromJson(dashboardModel)
	}

	evaluator := &DashTemplateEvaluator{
		template: dashboard.Data,
		inputs:   inputs,
	}

	generatedDash, err := evaluator.Eval()
	if err != nil {
		return plugins.PluginDashboardInfoDTO{}, &models.Dashboard{}, err
	}

	saveCmd := models.SaveDashboardCommand{
		Dashboard: generatedDash,
		OrgId:     orgID,
		UserId:    user.UserId,
		Overwrite: overwrite,
		PluginId:  pluginID,
		FolderId:  folderID,
	}

	dto := &dashboards.SaveDashboardDTO{
		OrgId:     orgID,
		Dashboard: saveCmd.GetDashboardModel(),
		Overwrite: saveCmd.Overwrite,
		User:      user,
	}

	savedDash, err := dashboards.NewService(m.sqlStore).ImportDashboard(ctx, dto)
	if err != nil {
		return plugins.PluginDashboardInfoDTO{}, &models.Dashboard{}, err
	}

	return plugins.PluginDashboardInfoDTO{
		UID:              savedDash.Uid,
		PluginId:         pluginID,
		Title:            savedDash.Title,
		Path:             path,
		Revision:         savedDash.Data.Get("revision").MustInt64(1),
		FolderId:         savedDash.FolderId,
		ImportedUri:      "db/" + savedDash.Slug,
		ImportedUrl:      savedDash.GetUrl(),
		ImportedRevision: dashboard.Data.Get("revision").MustInt64(1),
		Imported:         true,
		DashboardId:      savedDash.Id,
		Slug:             savedDash.Slug,
	}, savedDash, nil
}
