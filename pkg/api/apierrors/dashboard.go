package apierrors

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/util"
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
	if errors.Is(err, dashboards.ErrFolderNotFound) ||
		errors.Is(err, folder.ErrNameExists) {
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
	if statusErr, ok := errors.AsType[*apierrors.StatusError](err); ok {
		// The k8s dashboard apiserver returns NotFound on the folders resource when the
		// referenced folder UID does not exist. Map that back to the legacy
		// /api/dashboards/db contract (400 + "folder not found") so existing clients keep
		// working after the direct-to-client routing change.
		if apierrors.IsNotFound(err) {
			if d := statusErr.ErrStatus.Details; d != nil && d.Group == folderv1.APIGroup && d.Kind == folderv1.RESOURCE {
				return response.Error(http.StatusBadRequest, dashboards.ErrFolderNotFound.Error(), nil)
			}
		}
		return response.Error(int(statusErr.ErrStatus.Code), statusErr.ErrStatus.Message, err)
	}

	return response.ErrOrFallback(http.StatusInternalServerError, fmt.Sprintf("Dashboard API error: %s", err.Error()), err)
}
