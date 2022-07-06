package apierrors

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/util"
)

// ToDashboardErrorResponse returns a different response status according to the dashboard error type
func ToDashboardErrorResponse(ctx context.Context, pluginStore plugins.Store, err error) response.Response {
	var dashboardErr dashboards.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		if body := dashboardErr.Body(); body != nil {
			return response.JSON(dashboardErr.StatusCode, body)
		}
		if dashboardErr.StatusCode != http.StatusBadRequest {
			return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
		}
		return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), nil)
	}

	if errors.Is(err, dashboards.ErrFolderNotFound) {
		return response.Error(http.StatusBadRequest, err.Error(), nil)
	}

	var validationErr alerting.ValidationError
	if ok := errors.As(err, &validationErr); ok {
		return response.Error(http.StatusUnprocessableEntity, validationErr.Error(), err)
	}

	var pluginErr dashboards.UpdatePluginDashboardError
	if ok := errors.As(err, &pluginErr); ok {
		message := fmt.Sprintf("The dashboard belongs to plugin %s.", pluginErr.PluginId)
		// look up plugin name
		if plugin, exists := pluginStore.Plugin(ctx, pluginErr.PluginId); exists {
			message = fmt.Sprintf("The dashboard belongs to plugin %s.", plugin.Name)
		}
		return response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "plugin-dashboard", "message": message})
	}

	return response.Error(http.StatusInternalServerError, "Failed to save dashboard", err)
}
