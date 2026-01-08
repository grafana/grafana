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
	// --- Dashboard errors ---
	var dashboardErr dashboardaccess.DashboardErr
	if errors.As(err, &dashboardErr) {
		if body := dashboardErr.Body(); body != nil {
			return response.JSON(dashboardErr.StatusCode, body)
		}
		if dashboardErr.StatusCode != http.StatusBadRequest {
			return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
		}
		return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), nil)
	}

	// --- 400 Bad Request ---
	if errors.Is(err, dashboards.ErrFolderNotFound) {
		return response.Error(http.StatusBadRequest, err.Error(), nil)
	}

	var pluginErr dashboards.UpdatePluginDashboardError
	if errors.As(err, &pluginErr) {
		message := fmt.Sprintf("The dashboard belongs to plugin %s.", pluginErr.PluginId)
		// look up plugin name
		if plugin, exists := pluginStore.Plugin(ctx, pluginErr.PluginId); exists {
			message = fmt.Sprintf("The dashboard belongs to plugin %s.", plugin.Name)
		}
		// --- 412 Precondition Failed ---
		return response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "plugin-dashboard", "message": message})
	}

	// --- 413 Payload Too Large ---
	if apierrors.IsRequestEntityTooLargeError(err) {
		return response.Error(http.StatusRequestEntityTooLarge, fmt.Sprintf("Dashboard is too large, max is %d MB", apiserver.MaxRequestBodyBytes/1024/1024), err)
	}

	// --- Kubernetes status errors ---
	var statusErr *apierrors.StatusError
	if errors.As(err, &statusErr) {
		return response.Error(int(statusErr.ErrStatus.Code), statusErr.ErrStatus.Message, err)
	}

	return response.ErrOrFallback(http.StatusInternalServerError, fmt.Sprintf("Dashboard API error: %s", err.Error()), err)
}
