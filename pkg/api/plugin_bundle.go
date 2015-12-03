package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

func GetPluginBundles(c *middleware.Context) Response {
	query := m.GetPluginBundlesQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to list Plugin Bundles", err)
	}

	installedBundlesMap := make(map[string]*dtos.PluginBundle)
	for t, b := range plugins.Bundles {
		installedBundlesMap[t] = &dtos.PluginBundle{
			Type:     b.Type,
			Enabled:  b.Enabled,
			Module:   b.Module,
			JsonData: make(map[string]interface{}),
		}
	}

	seenBundles := make(map[string]bool)

	result := make([]*dtos.PluginBundle, 0)
	for _, b := range query.Result {
		if def, ok := installedBundlesMap[b.Type]; ok {
			result = append(result, &dtos.PluginBundle{
				Type:     b.Type,
				Enabled:  b.Enabled,
				Module:   def.Module,
				JsonData: b.JsonData,
			})
			seenBundles[b.Type] = true
		}
	}

	for t, b := range installedBundlesMap {
		if _, ok := seenBundles[t]; !ok {
			result = append(result, b)
		}
	}

	return Json(200, result)
}

func UpdatePluginBundle(c *middleware.Context, cmd m.UpdatePluginBundleCmd) Response {
	cmd.OrgId = c.OrgId

	if _, ok := plugins.Bundles[cmd.Type]; !ok {
		return ApiError(404, "Bundle type not installed.", nil)
	}

	err := bus.Dispatch(&cmd)
	if err != nil {
		return ApiError(500, "Failed to update plugin bundle", err)
	}

	return ApiSuccess("Plugin updated")
}
