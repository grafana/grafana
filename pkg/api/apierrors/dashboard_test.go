package apierrors

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	k8sErrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/util"
)

type fakePluginStore struct {
	pluginstore.Store
	plugins map[string]pluginstore.Plugin
}

func (f *fakePluginStore) Plugin(_ context.Context, id string) (pluginstore.Plugin, bool) {
	p, ok := f.plugins[id]
	return p, ok
}

func TestToDashboardErrorResponse(t *testing.T) {
	pluginStoreWithPlugin := &fakePluginStore{
		plugins: map[string]pluginstore.Plugin{
			"test-plugin": {JSONData: plugins.JSONData{Name: "Test Plugin"}},
		},
	}
	pluginStoreWithoutPlugin := &fakePluginStore{
		plugins: map[string]pluginstore.Plugin{},
	}

	tests := []struct {
		name        string
		pluginStore pluginstore.Store
		input       error
		want        response.Response
	}{
		// --- 400 Bad Request ---
		{
			name:        "dashboard error with a bad-request status",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboardaccess.DashboardErr{Reason: "Bad Request", StatusCode: http.StatusBadRequest},
			want:        response.Error(http.StatusBadRequest, "Bad Request", nil),
		},
		// Per-error pins for the typed dashboard errors that the legacy
		// /api/dashboards/db endpoint used to map explicitly. They all flow
		// through the generic DashboardErr branch today, but the explicit cases
		// catch regressions if an error's StatusCode/Status fields change.
		{
			name:        "ErrDashboardWithSameUIDExists maps to 400",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrDashboardWithSameUIDExists,
			want:        response.Error(http.StatusBadRequest, dashboards.ErrDashboardWithSameUIDExists.Error(), nil),
		},
		{
			name:        "ErrDashboardFolderCannotHaveParent maps to 400",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrDashboardFolderCannotHaveParent,
			want:        response.Error(http.StatusBadRequest, dashboards.ErrDashboardFolderCannotHaveParent.Error(), nil),
		},
		{
			name:        "ErrDashboardTypeMismatch maps to 400",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrDashboardTypeMismatch,
			want:        response.Error(http.StatusBadRequest, dashboards.ErrDashboardTypeMismatch.Error(), nil),
		},
		{
			name:        "ErrDashboardInvalidUid maps to 400",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrDashboardInvalidUid,
			want:        response.Error(http.StatusBadRequest, dashboards.ErrDashboardInvalidUid.Error(), nil),
		},
		{
			name:        "ErrDashboardUidTooLong maps to 400",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrDashboardUidTooLong,
			want:        response.Error(http.StatusBadRequest, dashboards.ErrDashboardUidTooLong.Error(), nil),
		},
		{
			name:        "ErrDashboardCannotSaveProvisionedDashboard maps to 400",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrDashboardCannotSaveProvisionedDashboard,
			want:        response.Error(http.StatusBadRequest, dashboards.ErrDashboardCannotSaveProvisionedDashboard.Error(), nil),
		},
		{
			// ErrDashboardTitleEmpty carries Status="empty-name", so the response
			// must be a JSON body, not a bare error string.
			name:        "ErrDashboardTitleEmpty maps to 400 with status body",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrDashboardTitleEmpty,
			want:        response.JSON(http.StatusBadRequest, util.DynMap{"status": "empty-name", "message": dashboards.ErrDashboardTitleEmpty.Error()}),
		},
		{
			// folder.ErrNameExists has its own explicit branch in
			// ToDashboardErrorResponse alongside dashboards.ErrFolderNotFound.
			name:        "folder.ErrNameExists maps to 400",
			pluginStore: pluginStoreWithoutPlugin,
			input:       folder.ErrNameExists.Errorf("%s", "A folder with that name already exists"),
			want:        response.Error(http.StatusBadRequest, folder.ErrNameExists.Errorf("%s", "A folder with that name already exists").Error(), nil),
		},
		// --- 403 Forbidden ---
		{
			name:        "dashboard error with a forbidden status",
			pluginStore: pluginStoreWithoutPlugin,
			input:       &k8sErrors.StatusError{ErrStatus: metav1.Status{Code: http.StatusForbidden, Message: "access denied"}},
			want:        response.Error(http.StatusForbidden, "access denied", &k8sErrors.StatusError{ErrStatus: metav1.Status{Code: http.StatusForbidden, Message: "access denied"}}),
		},
		{
			name:        "ErrDashboardUpdateAccessDenied maps to 403",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrDashboardUpdateAccessDenied,
			want:        response.Error(http.StatusForbidden, dashboards.ErrDashboardUpdateAccessDenied.Error(), dashboards.ErrDashboardUpdateAccessDenied),
		},
		// --- 404 Not Found ---
		{
			name:        "folder not found error",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrFolderNotFound,
			want:        response.Error(http.StatusBadRequest, dashboards.ErrFolderNotFound.Error(), nil),
		},
		{
			// ErrDashboardNotFound carries Status="not-found", so the response
			// is a JSON body produced by DashboardErr.Body().
			name:        "ErrDashboardNotFound maps to 404 with status body",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrDashboardNotFound,
			want:        response.JSON(http.StatusNotFound, util.DynMap{"status": "not-found", "message": dashboards.ErrDashboardNotFound.Error()}),
		},
		{
			// k8s dashboard apiserver surfaces a NotFound on the folders resource when the
			// referenced folder UID does not exist; legacy /api/dashboards/db must stay 400.
			name:        "k8s folder not found is mapped to legacy 400",
			pluginStore: pluginStoreWithoutPlugin,
			input:       k8sErrors.NewNotFound(folderv1.FolderResourceInfo.GroupResource(), "unknown"),
			want:        response.Error(http.StatusBadRequest, dashboards.ErrFolderNotFound.Error(), nil),
		},
		{
			name:        "k8s not found for non-folder resource passes through",
			pluginStore: pluginStoreWithoutPlugin,
			input:       k8sErrors.NewNotFound(schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}, "abc"),
			want:        response.Error(http.StatusNotFound, `dashboards.dashboard.grafana.app "abc" not found`, k8sErrors.NewNotFound(schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}, "abc")),
		},
		{
			name:        "dashboard error with a non-bad-request status",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboardaccess.DashboardErr{Reason: "Not Found", StatusCode: http.StatusNotFound},
			want:        response.Error(http.StatusNotFound, "Not Found", dashboardaccess.DashboardErr{Reason: "Not Found", StatusCode: http.StatusNotFound}),
		},
		{
			name:        "plugin dashboard error where plugin is found",
			pluginStore: pluginStoreWithPlugin,
			input:       dashboards.UpdatePluginDashboardError{PluginId: "test-plugin"},
			want:        response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "plugin-dashboard", "message": "The dashboard belongs to plugin Test Plugin."}),
		},
		// --- 412 Precondition Failed ---
		{
			name:        "plugin dashboard error where plugin is not found",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.UpdatePluginDashboardError{PluginId: "unknown-plugin"},
			want:        response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "plugin-dashboard", "message": "The dashboard belongs to plugin unknown-plugin."}),
		},
		{
			// ErrDashboardVersionMismatch carries Status="version-mismatch", so
			// the response is the JSON body produced by DashboardErr.Body().
			name:        "ErrDashboardVersionMismatch maps to 412 with status body",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrDashboardVersionMismatch,
			want:        response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "version-mismatch", "message": dashboards.ErrDashboardVersionMismatch.Error()}),
		},
		// --- 413 Payload Too Large ---
		{
			name:        "request entity too large error",
			pluginStore: pluginStoreWithoutPlugin,
			input:       k8sErrors.NewRequestEntityTooLargeError("request is too large"),
			want:        response.Error(http.StatusRequestEntityTooLarge, fmt.Sprintf("Dashboard is too large, max is %d MB", apiserver.MaxRequestBodyBytes/1024/1024), k8sErrors.NewRequestEntityTooLargeError("request is too large")),
		},
		// --- Kubernetes status errors ---
		{
			name:        "kubernetes status error",
			pluginStore: pluginStoreWithoutPlugin,
			input: &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    412,
					Message: "the dashboard has been changed by someone else",
				},
			},
			want: response.Error(412, "the dashboard has been changed by someone else", &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    412,
					Message: "the dashboard has been changed by someone else",
				},
			}),
		},
		// --- 500 Internal Server Error ---
		{
			name:        "fallback error for an unknown error",
			pluginStore: pluginStoreWithoutPlugin,
			input:       errors.New("an unexpected error"),
			want:        response.Error(http.StatusInternalServerError, "Dashboard API error: an unexpected error", errors.New("an unexpected error")),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := ToDashboardErrorResponse(context.Background(), tt.pluginStore, tt.input)
			require.Equal(t, tt.want, res)
		})
	}
}
