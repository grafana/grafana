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

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gopkg.in/ini.v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/kubernetes/scheme"

	"github.com/grafana/grafana-app-sdk/logging"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	folderlegacy "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestFolderListFilterStorage(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1})
	remaining := int64(5)
	list := &folders.FolderList{ListMeta: metav1.ListMeta{
		ResourceVersion: "42", Continue: "next", RemainingItemCount: &remaining,
	}}
	for _, item := range []struct{ name, parent string }{
		{"ordinary", "general"},
		{accesscontrol.K6FolderUID, "general"},
		{"direct-child", accesscontrol.K6FolderUID},
		{"grandchild", "direct-child"},
		{"unrelated", "other"},
	} {
		obj := &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: item.name}}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetFolder(item.parent)
		list.Items = append(list.Items, *obj)
	}
	sourceList := list.DeepCopy()

	store := grafanarest.NewMockStorage(t)
	store.On("List", ctx, (*internalversion.ListOptions)(nil)).Return(list, nil).Once()
	result, err := (&cascadeDeleteStorage{Storage: store}).List(ctx, nil)
	require.NoError(t, err)
	filtered := result.(*folders.FolderList)
	require.Len(t, filtered.Items, 3)
	require.Equal(t, []string{"ordinary", "grandchild", "unrelated"}, []string{
		filtered.Items[0].Name, filtered.Items[1].Name, filtered.Items[2].Name,
	})
	require.Equal(t, "42", filtered.ResourceVersion)
	require.Equal(t, "next", filtered.Continue)
	require.Nil(t, filtered.RemainingItemCount)

	serviceAccount := &identity.StaticRequester{Type: claims.TypeServiceAccount}
	internalService := &identity.StaticRequester{Type: claims.TypeAccessPolicy, UserUID: "service"}
	internalCtx := claims.WithAuthInfo(context.Background(), internalService)
	internalCtx = identity.WithRequester(internalCtx, internalService)
	for _, tc := range []struct {
		name string
		ctx  context.Context
	}{
		{name: "service accounts retain k6 folders", ctx: identity.WithRequester(context.Background(), serviceAccount)},
		{name: "internal services retain k6 folders", ctx: internalCtx},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := grafanarest.NewMockStorage(t)
			store.On("List", tc.ctx, (*internalversion.ListOptions)(nil)).Return(sourceList.DeepCopy(), nil).Once()
			result, err := (&cascadeDeleteStorage{Storage: store}).List(tc.ctx, nil)
			require.NoError(t, err)
			serviceFiltered := result.(*folders.FolderList)
			require.Len(t, serviceFiltered.Items, 5)
			require.NotNil(t, serviceFiltered.RemainingItemCount)
		})
	}
}

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

func newRefreshingFolderStorage(t *testing.T, permErr error, acService accesscontrol.Service) (folderStorage, *FolderAPIBuilder) {
	t.Helper()
	folderPermService := acmock.NewMockedPermissionsService()
	folderPermService.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, permErr).Once()

	store := grafanarest.NewMockStorage(t)
	store.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&folders.Folder{}, nil)

	b := &FolderAPIBuilder{acService: acService}
	return folderStorage{
		folderPermissionsSvc: folderPermService,
		refreshCreator:       b.refreshCreatorAfterCommit,
		store:                store,
		permissionsOnCreate:  true,
	}, b
}

func TestFolderStorageCreateRefreshesCreatorPermissions(t *testing.T) {
	creators := map[string]*user.SignedInUser{
		"user":            {UserID: 1, OrgID: 2},
		"service account": {UserID: 3, OrgID: 2, IsServiceAccount: true},
	}

	for name, creator := range creators {
		t.Run("reloads permissions for "+name+" creator", func(t *testing.T) {
			acService := acmock.New()
			var reloaded []accesscontrol.Options
			acService.GetUserPermissionsFunc = func(_ context.Context, u identity.Requester, opts accesscontrol.Options) ([]accesscontrol.Permission, error) {
				require.Equal(t, creator.GetCacheKey(), u.GetCacheKey())
				reloaded = append(reloaded, opts)
				return nil, nil
			}
			fs, _ := newRefreshingFolderStorage(t, nil, acService)

			ctx := identity.WithRequester(request.WithNamespace(context.Background(), "org-2"), creator)
			_, err := fs.Create(ctx, &folders.Folder{}, nil, &metav1.CreateOptions{})
			require.NoError(t, err)

			require.Equal(t, []accesscontrol.Options{{ReloadCache: true}}, reloaded)
		})
	}

	t.Run("does not reload permissions when setting default permissions fails", func(t *testing.T) {
		acService := acmock.New()
		acService.GetUserPermissionsFunc = func(context.Context, identity.Requester, accesscontrol.Options) ([]accesscontrol.Permission, error) {
			t.Fatal("permissions must not be reloaded after a failed permission write")
			return nil, nil
		}
		fs, _ := newRefreshingFolderStorage(t, errors.New("write failed"), acService)

		ctx := identity.WithRequester(request.WithNamespace(context.Background(), "org-2"), creators["user"])
		_, err := fs.Create(ctx, &folders.Folder{}, nil, &metav1.CreateOptions{})
		require.Error(t, err)
	})
}

func TestIntegrationFolderStorageCreateRefreshesCreatorPermissionsAfterCommit(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, serviceAccount := range []bool{false, true} {
		for _, outcome := range []string{"commit", "rollback", "permission failure"} {
			name := "user/"
			if serviceAccount {
				name = "service account/"
			}
			t.Run(name+outcome, func(t *testing.T) {
				sql := sqlstore.NewTestStore(t, sqlstore.WithoutMigrator())
				creator := &user.SignedInUser{UserID: 7, OrgID: 2, IsServiceAccount: serviceAccount}
				failure := errors.New("failed")
				var writeErr error
				if outcome == "permission failure" {
					writeErr = failure
				}

				calls := 0
				acService := acmock.New()
				acService.GetUserPermissionsFunc = func(ctx context.Context, u identity.Requester, opts accesscontrol.Options) ([]accesscontrol.Permission, error) {
					require.False(t, sqlstore.IsInTransaction(ctx))
					require.Same(t, creator, u)
					require.True(t, opts.ReloadCache)
					calls++
					return nil, nil
				}
				fs, b := newRefreshingFolderStorage(t, writeErr, acService)
				sql.Bus().AddEventListener(b.onDefaultPermissionsSet)

				ctx := identity.WithRequester(request.WithNamespace(t.Context(), "org-2"), creator)
				err := sql.InTransaction(ctx, func(ctx context.Context) error {
					require.NoError(t, sql.InTransaction(ctx, func(ctx context.Context) error {
						_, err := fs.Create(ctx, &folders.Folder{}, nil, &metav1.CreateOptions{})
						require.ErrorIs(t, err, writeErr)
						return nil
					}))
					require.Zero(t, calls, "permissions must not be reloaded before the outermost commit")
					if outcome == "rollback" {
						return failure
					}
					return nil
				})
				if outcome == "rollback" {
					require.ErrorIs(t, err, failure)
				} else {
					require.NoError(t, err)
				}

				if outcome == "commit" {
					require.Equal(t, 1, calls)
				} else {
					require.Zero(t, calls)
				}
			})
		}
	}
}
