package apierrors_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/require"
	k8sErrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestToFolderErrorResponse(t *testing.T) {
	reasonOnlyConflict := &k8sErrors.StatusError{ErrStatus: metav1.Status{
		Reason: metav1.StatusReasonConflict, Message: "private storage details",
	}}
	reasonOnlyDuplicate := &k8sErrors.StatusError{ErrStatus: metav1.Status{
		Reason: metav1.StatusReasonAlreadyExists, Message: "private storage details",
	}}
	tests := []struct {
		name  string
		input error
		want  response.Response
	}{
		// --- 400 Bad Request ---
		{
			name:  "dashboard error",
			input: dashboardaccess.DashboardErr{StatusCode: http.StatusBadRequest, Reason: "Dashboard Error", Status: "error"},
			want:  response.Error(http.StatusBadRequest, "Dashboard Error", dashboardaccess.DashboardErr{StatusCode: http.StatusBadRequest, Reason: "Dashboard Error", Status: "error"}),
		},
		{
			name:  "maximum depth reached",
			input: folder.ErrMaximumDepthReached.Errorf("Maximum nested folder depth reached"),
			want:  response.Error(http.StatusBadRequest, "[folder.maximum-depth-reached] Maximum nested folder depth reached", nil),
		},
		{
			name:  "maximum depth reached (validate.go call site)",
			input: folder.ErrMaximumDepthReached.Errorf("folder max depth exceeded, max depth is %d", 4),
			want:  response.Error(http.StatusBadRequest, "[folder.maximum-depth-reached] folder max depth exceeded, max depth is 4", nil),
		},
		{
			name:  "bad request errors",
			input: folder.ErrBadRequest.Errorf("Bad request error"),
			want:  response.Err(folder.ErrBadRequest.Errorf("Bad request error")),
		},
		{
			name:  "conflict error",
			input: folder.ErrConflict.Errorf("Conflict error"),
			want:  response.Err(folder.ErrConflict.Errorf("Conflict error")),
		},
		{
			name:  "circular reference error",
			input: folder.ErrCircularReference.Errorf("Circular reference detected"),
			want:  response.Err(folder.ErrCircularReference.Errorf("Circular reference detected")),
		},

		{
			name:  "folder not empty error",
			input: folder.ErrFolderNotEmpty.Errorf("Folder cannot be deleted: folder is not empty"),
			want:  response.Err(folder.ErrFolderNotEmpty.Errorf("Folder cannot be deleted: folder is not empty")),
		},
		{
			name:  "folder title empty",
			input: folder.ErrTitleEmpty,
			want:  response.Error(http.StatusBadRequest, "folder title cannot be empty", nil),
		},
		{
			name:  "folder title empty (apiserver wrapped)",
			input: folder.ErrAPITitleEmpty,
			want:  response.Error(http.StatusBadRequest, "folder title cannot be empty", nil),
		},
		{
			name:  "dashboard type mismatch",
			input: dashboards.ErrDashboardTypeMismatch,
			want:  response.Error(http.StatusBadRequest, "Dashboard cannot be changed to a folder", dashboards.ErrDashboardTypeMismatch),
		},
		{
			name:  "dashboard invalid uid",
			input: dashboards.ErrDashboardInvalidUid,
			want:  response.Error(http.StatusBadRequest, "uid contains illegal characters", dashboards.ErrDashboardInvalidUid),
		},
		{
			name:  "dashboard invalid uid (apiserver wrapped)",
			input: folders.ErrAPIInvalidUID,
			want:  response.Error(http.StatusBadRequest, "uid contains illegal characters", folders.ErrAPIInvalidUID),
		},
		{
			name:  "dashboard uid too long",
			input: dashboards.ErrDashboardUidTooLong,
			want:  response.Error(http.StatusBadRequest, "uid too long, max 40 characters", dashboards.ErrDashboardUidTooLong),
		},
		{
			name:  "dashboard uid too long (apiserver wrapped)",
			input: folders.ErrAPIUIDTooLong,
			want:  response.Error(http.StatusBadRequest, "uid too long, max 40 characters", folders.ErrAPIUIDTooLong),
		},
		{
			name:  "folder cannot be parent of itself",
			input: folder.ErrFolderCannotBeParentOfItself,
			want:  response.Error(http.StatusBadRequest, "folder cannot be parent of itself", nil),
		},
		{
			name:  "folder cannot be parent of itself (apiserver wrapped)",
			input: folder.ErrAPIFolderCannotBeParentOfItself,
			want:  response.Error(http.StatusBadRequest, "folder cannot be parent of itself", nil),
		},
		{
			name:  "invalid uid",
			input: folder.ErrInvalidUID,
			want:  response.Error(http.StatusBadRequest, "invalid uid for folder provided", nil),
		},
		{
			name:  "invalid uid (apiserver wrapped)",
			input: folder.ErrAPIInvalidUID,
			want:  response.Error(http.StatusBadRequest, "invalid uid for folder provided", nil),
		},
		{
			// Custom-context wrappers (non-errutil) keep their added context.
			name:  "folder title empty wrapped with custom context",
			input: fmt.Errorf("save folder: %w", folder.ErrTitleEmpty),
			want:  response.Error(http.StatusBadRequest, "save folder: folder title cannot be empty", nil),
		},
		// --- 403 Forbidden ---
		{
			name:  "folder access denied",
			input: folder.ErrAccessDenied,
			want:  response.Error(http.StatusForbidden, "Access denied", folder.ErrAccessDenied),
		},
		// --- 404 Not Found ---
		{
			name:  "folder not found",
			input: dashboards.ErrFolderNotFound,
			want:  response.JSON(http.StatusNotFound, util.DynMap{"status": "not-found", "message": dashboards.ErrFolderNotFound.Error()}),
		},
		// --- 409 Conflict ---
		{
			name:  "folder with same uid exists",
			input: folder.ErrSameUIDExists,
			want:  response.Error(http.StatusConflict, "a folder with the same UID already exists", folder.ErrSameUIDExists),
		},
		{
			name:  "reason-only conflict",
			input: reasonOnlyConflict,
			want:  response.Error(http.StatusConflict, "the folder operation conflicted with another request; please retry", reasonOnlyConflict),
		},
		{
			name:  "reason-only duplicate",
			input: reasonOnlyDuplicate,
			want:  response.Error(http.StatusConflict, "a folder with the same UID already exists", reasonOnlyDuplicate),
		},
		// --- 412 Precondition Failed ---
		{
			name:  "folder version mismatch",
			input: folder.ErrVersionMismatch,
			want:  response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "version-mismatch", "message": folder.ErrVersionMismatch.Error()}),
		},
		// --- 500 Internal Server Error ---
		{
			name:  "target registry srv conflict error",
			input: folder.ErrTargetRegistrySrvConflict.Errorf("Target registry service conflict"),
			want:  response.Err(folder.ErrTargetRegistrySrvConflict.Errorf("Target registry service conflict")),
		},
		{
			name:  "internal error",
			input: folder.ErrInternal.Errorf("Internal error"),
			want:  response.Err(folder.ErrInternal.Errorf("Internal error")),
		},
		{
			name:  "database error",
			input: folder.ErrDatabaseError.Errorf("Database error"),
			want:  response.Err(folder.ErrDatabaseError.Errorf("Database error")),
		},
		{
			name:  "fallback error for an unknown error",
			input: errors.New("an unexpected error"),
			want:  response.Error(http.StatusInternalServerError, "Folder API error: an unexpected error", errors.New("an unexpected error")),
		},
		{
			name:  "canceled request",
			input: context.Canceled,
			want:  response.ErrOrFallback(http.StatusInternalServerError, "unused fallback", context.Canceled),
		},
		{
			name:  "wrapped canceled request",
			input: fmt.Errorf("create failed: %w", context.Canceled),
			want:  response.ErrOrFallback(http.StatusInternalServerError, "unused fallback", fmt.Errorf("create failed: %w", context.Canceled)),
		},
		// --- Kubernetes status errors ---
		{
			name: "kubernetes status error with message",
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
		{
			name: "kubernetes status error with empty message - 403 forbidden",
			input: &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusForbidden,
					Message: "",
				},
			},
			want: response.Error(http.StatusForbidden, "Access denied", &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusForbidden,
					Message: "",
				},
			}),
		},
		{
			name: "kubernetes status error with empty message - 404 not found",
			input: &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusNotFound,
					Message: "",
				},
			},
			want: response.Error(http.StatusNotFound, "Folder not found", &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusNotFound,
					Message: "",
				},
			}),
		},
		{
			name: "kubernetes status error with empty message - 400 bad request",
			input: &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusBadRequest,
					Message: "",
				},
			},
			want: response.Error(http.StatusBadRequest, "Invalid request", &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusBadRequest,
					Message: "",
				},
			}),
		},
		{
			name: "kubernetes status error with empty message - default fallback",
			input: &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusInternalServerError,
					Message: "",
				},
			},
			want: response.Error(http.StatusInternalServerError, "Folder API error", &k8sErrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusInternalServerError,
					Message: "",
				},
			}),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := apierrors.ToFolderErrorResponse(tt.input)
			require.Equal(t, tt.want, resp)

			var body struct {
				Message string `json:"message"`
			}
			require.NoError(t, json.Unmarshal(tt.want.Body(), &body))
			status := apierrors.ToFolderStatusError(tt.input)
			require.Equal(t, int32(tt.want.Status()), status.ErrStatus.Code)
			require.Equal(t, body.Message, status.ErrStatus.Message)
		})
	}
}

func TestToFolderStatusErrorPreservesMetadata(t *testing.T) {
	for name, original := range map[string]*k8sErrors.StatusError{
		"timeout":   k8sErrors.NewTimeoutError("storage timeout", 7),
		"throttled": k8sErrors.NewTooManyRequests("retry later", 7),
		"conflict": {ErrStatus: metav1.Status{
			Code: http.StatusConflict, Reason: metav1.StatusReasonConflict, Message: "private storage details",
			Details: &metav1.StatusDetails{Group: "folder.grafana.app", Kind: "folders", Name: "parent", RetryAfterSeconds: 7},
		}},
		"duplicate": {ErrStatus: metav1.Status{
			Code: http.StatusConflict, Reason: metav1.StatusReasonAlreadyExists, Message: "private storage details",
			Details: &metav1.StatusDetails{Group: "folder.grafana.app", Kind: "folders", Name: "parent"},
		}},
	} {
		for wrapper, input := range map[string]error{
			"direct":  original,
			"wrapped": fmt.Errorf("create failed: %w", original),
		} {
			t.Run(name+"/"+wrapper, func(t *testing.T) {
				before := original.ErrStatus.DeepCopy()
				converted := apierrors.ToFolderStatusError(input)
				require.Equal(t, original.ErrStatus.Code, converted.ErrStatus.Code)
				require.Equal(t, original.ErrStatus.Reason, converted.ErrStatus.Reason)
				require.Equal(t, original.ErrStatus.Details, converted.ErrStatus.Details)
				switch name {
				case "conflict":
					require.Equal(t, "the folder operation conflicted with another request; please retry", converted.ErrStatus.Message)
				case "duplicate":
					require.Equal(t, "a folder with the same UID already exists", converted.ErrStatus.Message)
				default:
					require.Equal(t, original.ErrStatus.Message, converted.ErrStatus.Message)
				}
				converted.ErrStatus.Details.RetryAfterSeconds++
				require.Equal(t, *before, original.ErrStatus)
			})
		}
	}
}

func TestToFolderStatusErrorPreservesMetadataDuringNormalization(t *testing.T) {
	for _, reason := range []metav1.StatusReason{metav1.StatusReasonConflict, metav1.StatusReasonAlreadyExists} {
		original := &k8sErrors.StatusError{ErrStatus: metav1.Status{
			Code: http.StatusInternalServerError, Reason: reason, Message: "private storage details",
			Details: &metav1.StatusDetails{Group: "folder.grafana.app", Kind: "folders", Name: "parent", RetryAfterSeconds: 7},
		}}
		for wrapper, input := range map[string]error{
			"direct":          original,
			"wrapped":         fmt.Errorf("create failed: %w", original),
			"Grafana wrapper": folder.ErrInternal.Errorf("create failed: %w", original),
		} {
			t.Run(string(reason)+"/"+wrapper, func(t *testing.T) {
				before := original.ErrStatus.DeepCopy()
				converted := apierrors.ToFolderStatusError(input)
				require.Equal(t, int32(http.StatusConflict), converted.ErrStatus.Code)
				require.Equal(t, reason, converted.ErrStatus.Reason)
				require.NotNil(t, converted.ErrStatus.Details)
				require.Equal(t, int32(7), converted.ErrStatus.Details.RetryAfterSeconds)
				if wrapper == "Grafana wrapper" {
					require.Equal(t, "folder.internal", string(converted.ErrStatus.Details.UID))
				} else {
					require.Equal(t, original.ErrStatus.Details, converted.ErrStatus.Details)
				}
				converted.ErrStatus.Details.RetryAfterSeconds++
				require.Equal(t, *before, original.ErrStatus)
			})
		}
	}
}

func TestToFolderStatusErrorPreservesGrafanaIDWithRetryMetadata(t *testing.T) {
	original := k8sErrors.NewTimeoutError("storage timeout", 7)
	input := folder.ErrInternal.Errorf("create failed: %w", original)
	before := input.Status()
	converted := apierrors.ToFolderStatusError(input)
	require.Equal(t, original.ErrStatus.Code, converted.ErrStatus.Code)
	require.Equal(t, original.ErrStatus.Message, converted.ErrStatus.Message)
	require.Equal(t, metav1.StatusReasonTimeout, converted.ErrStatus.Reason)
	require.Equal(t, "folder.internal", string(converted.ErrStatus.Details.UID))
	require.Equal(t, int32(7), converted.ErrStatus.Details.RetryAfterSeconds)
	require.Equal(t, before, input.Status())
}

func TestToFolderStatusErrorDoesNotCopyContradictoryMetadata(t *testing.T) {
	original := &k8sErrors.StatusError{ErrStatus: metav1.Status{
		Code: http.StatusForbidden, Reason: metav1.StatusReasonForbidden, Message: "denied",
		Details: &metav1.StatusDetails{Name: "parent", RetryAfterSeconds: 7},
	}}
	converted := apierrors.ToFolderStatusError(errors.Join(folder.ErrVersionMismatch, original))
	require.Equal(t, int32(http.StatusPreconditionFailed), converted.ErrStatus.Code)
	require.Equal(t, folder.ErrVersionMismatch.Error(), converted.ErrStatus.Message)
	require.Empty(t, converted.ErrStatus.Reason)
	require.Nil(t, converted.ErrStatus.Details)
}

// TestErrorsIs_UnwrapsAPIWrappers tests that errors.Is matches the legacy sentinel via
// the Unwrap chain.
func TestErrorsIs_UnwrapsAPIWrappers(t *testing.T) {
	cases := []struct {
		name    string
		wrapped error
		legacy  error
	}{
		{"title empty", folder.ErrAPITitleEmpty, folder.ErrTitleEmpty},
		{"invalid uid", folder.ErrAPIInvalidUID, folder.ErrInvalidUID},
		{"folder cannot be parent of itself", folder.ErrAPIFolderCannotBeParentOfItself, folder.ErrFolderCannotBeParentOfItself},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			require.True(t, errors.Is(c.wrapped, c.legacy),
				"errors.Is must walk Unwrap to match the legacy sentinel; got %v", c.wrapped)
		})
	}
}
