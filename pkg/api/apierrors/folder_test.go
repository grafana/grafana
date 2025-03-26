package apierrors

import (
	"errors"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/require"
	k8sErrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestToFolderErrorResponse(t *testing.T) {
	tests := []struct {
		name  string
		input error
		want  response.Response
	}{
		{
			name:  "dashboard error",
			input: dashboardaccess.DashboardErr{StatusCode: 400, Reason: "Dashboard Error", Status: "error"},
			want:  response.Error(400, "Dashboard Error", dashboardaccess.DashboardErr{StatusCode: 400, Reason: "Dashboard Error", Status: "error"}),
		},
		{
			name:  "folder title empty",
			input: dashboards.ErrFolderTitleEmpty,
			want:  response.Error(400, "folder title cannot be empty", nil),
		},
		{
			name:  "dashboard type mismatch",
			input: dashboards.ErrDashboardTypeMismatch,
			want:  response.Error(400, "Dashboard cannot be changed to a folder", dashboards.ErrDashboardTypeMismatch),
		},
		{
			name:  "dashboard invalid uid",
			input: dashboards.ErrDashboardInvalidUid,
			want:  response.Error(400, "uid contains illegal characters", dashboards.ErrDashboardInvalidUid),
		},
		{
			name:  "dashboard uid too long",
			input: dashboards.ErrDashboardUidTooLong,
			want:  response.Error(400, "uid too long, max 40 characters", dashboards.ErrDashboardUidTooLong),
		},
		{
			name:  "folder access denied",
			input: dashboards.ErrFolderAccessDenied,
			want:  response.Error(http.StatusForbidden, "Access denied", dashboards.ErrFolderAccessDenied),
		},
		{
			name:  "folder not found",
			input: dashboards.ErrFolderNotFound,
			want:  response.JSON(http.StatusNotFound, util.DynMap{"status": "not-found", "message": dashboards.ErrFolderNotFound.Error()}),
		},
		{
			name:  "folder with same uid exists",
			input: dashboards.ErrFolderWithSameUIDExists,
			want:  response.Error(http.StatusConflict, dashboards.ErrFolderWithSameUIDExists.Error(), nil),
		},
		{
			name:  "folder version mismatch",
			input: dashboards.ErrFolderVersionMismatch,
			want:  response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "version-mismatch", "message": dashboards.ErrFolderVersionMismatch.Error()}),
		},
		{
			name:  "folder max depth reached",
			input: folder.ErrMaximumDepthReached,
			want:  response.JSON(http.StatusBadRequest, util.DynMap{"messageId": "folder.maximum-depth-reached", "message": folder.ErrMaximumDepthReached.Error()}),
		},
		{
			name:  "fallback error",
			input: errors.New("some error"),
			want:  response.ErrOrFallback(http.StatusInternalServerError, "Folder API error", errors.New("some error")),
		},
		{
			name: "kubernetes status error",
			input: &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    412,
					Message: "the folder has been changed by someone else",
				},
			},
			want: response.Error(412, "the folder has been changed by someone else", &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    412,
					Message: "the folder has been changed by someone else",
				},
			}),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := ToFolderErrorResponse(tt.input)
			require.Equal(t, tt.want, resp)
		})
	}
}
