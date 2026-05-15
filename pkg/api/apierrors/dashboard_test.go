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

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
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
		// --- 403 Forbidden ---
		{
			name:        "dashboard error with a forbidden status",
			pluginStore: pluginStoreWithoutPlugin,
			input:       &k8sErrors.StatusError{ErrStatus: metav1.Status{Code: http.StatusForbidden, Message: "access denied"}},
			want:        response.Error(http.StatusForbidden, "access denied", &k8sErrors.StatusError{ErrStatus: metav1.Status{Code: http.StatusForbidden, Message: "access denied"}}),
		},
		// --- 404 Not Found ---
		{
			name:        "folder not found error",
			pluginStore: pluginStoreWithoutPlugin,
			input:       dashboards.ErrFolderNotFound,
			want:        response.Error(http.StatusBadRequest, dashboards.ErrFolderNotFound.Error(), nil),
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
