package folders

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gopkg.in/ini.v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/kubernetes/scheme"

	"github.com/grafana/grafana-app-sdk/logging"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	folderlegacy "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestFolderStorageCreateLogsOriginalError(t *testing.T) {
	storageErr := status.Error(codes.Aborted, "private storage details")
	for name, original := range map[string]error{
		"grpc": storageErr,
		"kubernetes after retries": apierrors.NewConflict(schema.GroupResource{
			Group: "folder.grafana.app", Resource: "folders",
		}, "foobar", storageErr),
	} {
		t.Run(name, func(t *testing.T) {
			var logs bytes.Buffer
			ctx := logging.Context(context.Background(), logging.NewSLogLogger(slog.NewJSONHandler(&logs, nil)))
			store := grafanarest.NewMockStorage(t)
			store.On("Create", ctx, mock.Anything, mock.Anything, mock.Anything).Return(nil, original).Once()
			fs := folderStorage{store: store}

			out, err := fs.Create(ctx, &folders.Folder{}, nil, &metav1.CreateOptions{})
			require.Nil(t, out)
			var publicErr *apierrors.StatusError
			require.ErrorAs(t, err, &publicErr)
			require.Equal(t, int32(http.StatusConflict), publicErr.ErrStatus.Code)
			require.Equal(t, metav1.StatusReasonConflict, publicErr.ErrStatus.Reason)
			require.Equal(t, "the folder operation conflicted with another request; please retry", publicErr.ErrStatus.Message)
			require.NotContains(t, err.Error(), "private storage details")

			var record map[string]interface{}
			require.NoError(t, json.Unmarshal(logs.Bytes(), &record))
			require.Equal(t, "Failed to create folder", record["msg"])
			require.Equal(t, original.Error(), record["error"])
		})
	}
}

func TestFolderStorageCreateErrorResponses(t *testing.T) {
	const private = "PRIVATE_STORAGE_DIAGNOSTIC"
	duplicate, err := status.New(codes.AlreadyExists, private).WithDetails(&resourcepb.ErrorResult{
		Code: 409, Reason: string(metav1.StatusReasonAlreadyExists), Message: private,
	})
	require.NoError(t, err)
	conflict := apierrors.NewConflict(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, "child", errors.New(private))
	for _, tc := range []struct {
		name    string
		err     error
		code    int
		reason  metav1.StatusReason
		message string
	}{
		{
			name: "invalid permissions annotation",
			err:  apierrors.NewBadRequest("invalid permissions value. only 'default' supported"),
			code: 400, reason: metav1.StatusReasonBadRequest,
			message: "invalid permissions value. only 'default' supported",
		},
		{
			name: "preparation parent read connection failure",
			err:  fmt.Errorf("failed to read folder hidden-parent: %w", errors.New(private)),
			code: 500, reason: metav1.StatusReasonInternalError, message: "Folder API error",
		},
		{
			name: "missing authentication context", err: errors.New("missing auth info"),
			code: 500, reason: metav1.StatusReasonInternalError, message: "Folder API error",
		},
		{
			name: "wrapped cancellation", err: fmt.Errorf("%s: %w", private, context.Canceled),
			code: 499, reason: "ClientClosedRequest", message: "Request canceled",
		},
		{
			name: "raw grpc permission denied", err: status.Error(codes.PermissionDenied, "Access denied"),
			code: 403, reason: metav1.StatusReasonForbidden, message: "rpc error: code = PermissionDenied desc = Access denied",
		},
		{
			name: "raw grpc unavailable", err: status.Error(codes.Unavailable, private),
			code: 503, reason: metav1.StatusReasonServiceUnavailable, message: "Service Unavailable",
		},
		{
			name: "grafana wrapped grpc duplicate", err: folderlegacy.ErrInternal.Errorf("%s: %w", private, duplicate.Err()),
			code: 409, reason: metav1.StatusReasonAlreadyExists, message: "a folder with the same UID already exists",
		},
		{
			name: "grafana wrapped unconfirmed grpc already exists", err: folderlegacy.ErrInternal.Errorf("%s: %w", private, status.Error(codes.AlreadyExists, private)),
			code: 409, reason: metav1.StatusReasonConflict, message: "the folder operation conflicted with another request; please retry",
		},
		{
			name: "grafana wrapped kubernetes conflict", err: folderlegacy.ErrInternal.Errorf("%s: %w", private, conflict),
			code: 409, reason: metav1.StatusReasonConflict, message: "the folder operation conflicted with another request; please retry",
		},
		{
			name: "joined version mismatch and conflict", err: errors.Join(folderlegacy.ErrVersionMismatch, conflict),
			code: 409, reason: metav1.StatusReasonConflict, message: "the folder operation conflicted with another request; please retry",
		},
		{
			name: "joined conflict and version mismatch", err: errors.Join(conflict, folderlegacy.ErrVersionMismatch),
			code: 409, reason: metav1.StatusReasonConflict, message: "the folder operation conflicted with another request; please retry",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := grafanarest.NewMockStorage(t)
			store.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, tc.err).Once()
			fs := folderStorage{store: store}
			out, err := fs.Create(context.Background(), &folders.Folder{}, nil, &metav1.CreateOptions{})
			require.Nil(t, out)
			require.Error(t, err)
			w := httptest.NewRecorder()
			responsewriters.ErrorNegotiated(err, scheme.Codecs, schema.GroupVersion{Version: "v1"}, w, httptest.NewRequest(http.MethodPost, "/folders", nil))
			require.Equal(t, tc.code, w.Code)
			var public metav1.Status
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &public))
			require.Equal(t, int32(tc.code), public.Code)
			require.Equal(t, tc.reason, public.Reason)
			require.Equal(t, tc.message, public.Message)
			require.NotContains(t, w.Body.String(), private)
			require.NotContains(t, w.Body.String(), "hidden-parent")
			require.NotContains(t, w.Body.String(), "missing auth info")
		})
	}
}

func TestSetDefaultPermissionsWhenCreatingFolder(t *testing.T) {
	type testCase struct {
		description                   string
		expectedCallsToSetPermissions int
	}

	tcs := []testCase{
		{
			description:                   "folder creation succeeds, via legacy storage",
			expectedCallsToSetPermissions: 1,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.description, func(t *testing.T) {
			folderPermService := acmock.NewMockedPermissionsService()
			folderPermService.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)

			cfg := setting.NewCfg()
			f := ini.Empty()
			f.Section("rbac").Key("resources_with_managed_permissions_on_creation").SetValue("folder")
			tempCfg, err := setting.NewCfgFromINIFile(f)
			require.NoError(t, err)
			cfg.RBAC = tempCfg.RBAC
			store := grafanarest.NewMockStorage(t)
			store.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Return(&folders.Folder{}, nil).Maybe() // we don't really care

			fs := folderStorage{
				folderPermissionsSvc: folderPermService,
				store:                store,
				permissionsOnCreate:  cfg.RBAC.PermissionsOnCreation("folder"),
			}
			obj := &folders.Folder{}

			ctx := request.WithNamespace(context.Background(), "org-2")
			ctx = identity.WithRequester(ctx, &user.SignedInUser{
				UserID: 1,
			})

			out, err := fs.Create(ctx, obj, func(ctx context.Context,
				obj runtime.Object) error {
				return nil
			},
				&metav1.CreateOptions{})

			require.NoError(t, err)
			require.NotNil(t, out)

			folderPermService.AssertNumberOfCalls(t, "SetPermissions", tc.expectedCallsToSetPermissions)
		})
	}
}
