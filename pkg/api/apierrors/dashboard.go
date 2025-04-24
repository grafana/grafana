package apierrors

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/util"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// ToDashboardErrorResponse returns a different response status according to the dashboard error type
func ToDashboardErrorResponse(ctx context.Context, pluginStore pluginstore.Store, err error) response.Response {
	var dashboardErr dashboardaccess.DashboardErr
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

	var pluginErr dashboards.UpdatePluginDashboardError
	if ok := errors.As(err, &pluginErr); ok {
		message := fmt.Sprintf("The dashboard belongs to plugin %s.", pluginErr.PluginId)
		// look up plugin name
		if plugin, exists := pluginStore.Plugin(ctx, pluginErr.PluginId); exists {
			message = fmt.Sprintf("The dashboard belongs to plugin %s.", plugin.Name)
		}
		return response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "plugin-dashboard", "message": message})
	}

	if apierrors.IsRequestEntityTooLargeError(err) {
		return response.Error(http.StatusRequestEntityTooLarge, fmt.Sprintf("Dashboard is too large, max is %d MB", apiserver.MaxRequestBodyBytes/1024/1024), err)
	}

	var statusErr *apierrors.StatusError
	if errors.As(err, &statusErr) {
		return response.Error(int(statusErr.ErrStatus.Code), statusErr.ErrStatus.Message, err)
	}

	return response.Error(http.StatusInternalServerError, "Failed to save dashboard", err)
}
