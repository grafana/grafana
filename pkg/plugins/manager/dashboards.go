package manager

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func (pm *PluginManager) GetPluginDashboards(orgID int64, pluginID string) ([]*plugins.PluginDashboardInfoDTO, error) {
	plugin := pm.GetPlugin(pluginID)

	if plugin == nil {
		return nil, plugins.PluginNotFoundError{PluginID: pluginID}
	}

	gv, err := semver.NewVersion(setting.BuildVersion)

	if err != nil {
		return nil, err
	}

	// clear the pre-release version. This prevents valid comparison - see https://github.com/Masterminds/semver#working-with-prerelease-versions
	grafanaVersion, _ := gv.SetPrerelease("")

	result := make([]*plugins.PluginDashboardInfoDTO, 0)

	// load current dashboards
	query := models.GetDashboardsByPluginIdQuery{OrgId: orgID, PluginId: pluginID}
	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	existingMatches := make(map[string]bool)
	for _, include := range plugin.Includes {
		if include.Type != plugins.PluginTypeDashboard {
			continue
		}

		dashboard, err := pm.LoadPluginDashboard(plugin.Id, include.Path)
		if err != nil {
			return nil, err
		}

		if dashboard.Uid == "" {
			plog.Info(fmt.Sprintf("Ignoring dashboard %s from %s as Uid is missing", dashboard.Slug, include.Path))
			continue
		}

		res := &plugins.PluginDashboardInfoDTO{}
		res.Path = include.Path
		res.PluginId = plugin.Id
		res.Title = dashboard.Title
		res.Revision = dashboard.Data.Get("revision").MustInt64(1)

		// find existing dashboard
		for _, existingDash := range query.Result {
			if existingDash.Uid == dashboard.Uid {
				res.DashboardId = existingDash.Id
				res.Imported = true
				res.ImportedUri = "db/" + existingDash.Slug
				res.ImportedUrl = existingDash.GetUrl()
				res.ImportedRevision = existingDash.Data.Get("revision").MustInt64(1)
				res.ImportedCompatible, err = isCompatible(grafanaVersion, existingDash.Data.Get("supportedVersions").MustString(""))
				res.SupportedVersions = existingDash.Data.Get("supportedVersions").MustString("")
				if err != nil {
					return nil, err
				}
				existingMatches[existingDash.Uid] = true
			}
		}

		if !res.Imported {
			// if its imported, the supported versions of the currently imported variant are more useful
			res.SupportedVersions = include.SupportedVersions
		}

		res.Compatible, err = isCompatible(grafanaVersion, include.SupportedVersions)
		if err != nil {
			return nil, err
		}

		if !res.Imported && !res.Compatible {
			// not imported and incompatible so skip - only case where the user doesn't see the result
			plog.Info(fmt.Sprintf("Dashboard %s for plugin %s is not compatible - requires Grafana %s", dashboard.Slug, plugin.Name, include.SupportedVersions))
			continue
		}

		result = append(result, res)
	}

	// find installed dashboards that have been deleted from the plugin
	for _, dash := range query.Result {
		if _, exists := existingMatches[dash.Uid]; !exists {
			result = append(result, &plugins.PluginDashboardInfoDTO{
				Slug:        dash.Slug,
				DashboardId: dash.Id,
				Removed:     true,
			})
		}
	}

	return result, nil
}

func isCompatible(version semver.Version, dashboardConstaint string) (bool, error) {
	//if no constraint is set we determine its compatible in the absence of other information
	if dashboardConstaint == "" {
		return true, nil
	}
	con, err := semver.NewConstraint(dashboardConstaint)
	if err != nil {
		return false, err
	}
	return con.Check(&version), nil
}

func (pm *PluginManager) LoadPluginDashboard(pluginID, path string) (*models.Dashboard, error) {
	plugin := pm.GetPlugin(pluginID)
	if plugin == nil {
		return nil, plugins.PluginNotFoundError{PluginID: pluginID}
	}

	dashboardFilePath := filepath.Join(plugin.PluginDir, path)
	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `plugin.PluginDir` is based
	// on plugin folder structure on disk and not user input. `path` comes from the
	// `plugin.json` configuration file for the loaded plugin
	reader, err := os.Open(dashboardFilePath)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := reader.Close(); err != nil {
			plog.Warn("Failed to close file", "path", dashboardFilePath, "err", err)
		}
	}()

	data, err := simplejson.NewFromReader(reader)
	if err != nil {
		return nil, err
	}

	return models.NewDashboardFromJson(data), nil
}
