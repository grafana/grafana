package folders

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
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
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	legacyapierrors "github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
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

func TestFolderStorageCreatePreservesParentLookupStatus(t *testing.T) {
	lookupErr := apierrors.NewTimeoutError("storage timeout", 7)
	store := grafanarest.NewMockStorage(t)
	store.On("Get", mock.Anything, "ancestor", &metav1.GetOptions{}).Return(nil, lookupErr).Once()
	store.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(func(ctx context.Context, obj runtime.Object, validation rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
			return nil, fmt.Errorf("create failed: %w", validation(ctx, obj))
		}).Once()
	fs := folderStorage{store: store}
	out, err := fs.Create(context.Background(), folderWithParent("child", "ancestor"), func(ctx context.Context, obj runtime.Object) error {
		return validateOnCreate(ctx, obj.(*folders.Folder), newParentsGetter(store, 5), 5, false)
	}, &metav1.CreateOptions{})
	require.Nil(t, out)
	require.Equal(t, lookupErr, err)
	require.Equal(t, responsewriters.ErrorToAPIStatus(lookupErr), responsewriters.ErrorToAPIStatus(err))
	require.Equal(t, int(lookupErr.ErrStatus.Code), legacyapierrors.ToFolderErrorResponse(err).Status())
}

func TestFolderStorageCreateNormalizesLegacyErrors(t *testing.T) {
	store := grafanarest.NewMockStorage(t)
	store.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, folder.ErrAPITitleEmpty).Once()
	fs := folderStorage{store: store}
	out, err := fs.Create(context.Background(), &folders.Folder{}, nil, &metav1.CreateOptions{})
	require.Nil(t, out)
	require.Error(t, err)
	apiStatus := responsewriters.ErrorToAPIStatus(err)
	require.Equal(t, int32(http.StatusBadRequest), apiStatus.Code)
	require.Equal(t, folder.ErrTitleEmpty.Error(), apiStatus.Message)
	require.NotNil(t, apiStatus.Details)
	require.Equal(t, "folder.title-empty", string(apiStatus.Details.UID))
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
