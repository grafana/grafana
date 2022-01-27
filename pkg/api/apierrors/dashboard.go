package apierrors

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/util"
)

// ToDashboardErrorResponse returns a different response status according to the dashboard error type
func ToDashboardErrorResponse(ctx context.Context, pluginStore plugins.Store, err error) response.Response {
	var dashboardErr models.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		if body := dashboardErr.Body(); body != nil {
			return response.JSON(dashboardErr.StatusCode, body)
		}
		if dashboardErr.StatusCode != 400 {
			return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
		}
		return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), nil)
	}

	if errors.Is(err, models.ErrFolderNotFound) {
		return response.Error(400, err.Error(), nil)
	}

	var validationErr alerting.ValidationError
	if ok := errors.As(err, &validationErr); ok {
		return response.Error(422, validationErr.Error(), err)
	}

	var pluginErr models.UpdatePluginDashboardError
	if ok := errors.As(err, &pluginErr); ok {
		message := fmt.Sprintf("The dashboard belongs to plugin %s.", pluginErr.PluginId)
		// look up plugin name
		if plugin, exists := pluginStore.Plugin(ctx, pluginErr.PluginId); exists {
			message = fmt.Sprintf("The dashboard belongs to plugin %s.", plugin.Name)
		}
		return response.JSON(412, util.DynMap{"status": "plugin-dashboard", "message": message})
	}

	return response.Error(500, "Failed to save dashboard", err)
}
