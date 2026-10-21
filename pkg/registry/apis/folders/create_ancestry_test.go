package folders

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/client-go/kubernetes/scheme"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func ancestryTestFolder(name, parent string) *folders.Folder {
	return &folders.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Annotations: map[string]string{utils.AnnoKeyFolder: parent},
		},
		Spec: folders.FolderSpec{Title: name},
	}
}

func ancestryTestContext(t *testing.T, namespace string, serviceAccount bool) context.Context {
	t.Helper()
	ns, err := authlib.ParseNamespace(namespace)
	require.NoError(t, err)
	return request.WithNamespace(identity.WithRequester(context.Background(), &user.SignedInUser{
		UserID: 1, OrgID: ns.OrgID, IsServiceAccount: serviceAccount,
	}), namespace)
}

func validateAncestryTestCreate(ctx context.Context, storage grafanarest.Storage, maxDepth int, dryRun bool) error {
	return validateAncestryTestCreateThroughStorage(ctx, storage, maxDepth, dryRun, nil)
}

func validateAncestryTestCreateThroughStorage(ctx context.Context, storage grafanarest.Storage, maxDepth int, dryRun bool, wrapper *folderStorage) error {
	b := &FolderAPIBuilder{
		storage:              storage,
		parents:              newParentsGetter(storage),
		maxNestedFolderDepth: maxDepth,
	}
	obj := ancestryTestFolder("new", "C")
	obj.Namespace = request.NamespaceValue(ctx)
	caller, _ := identity.GetRequester(ctx)
	validate := func(ctx context.Context, obj runtime.Object) error {
		return b.Validate(ctx, admission.NewAttributesRecord(
			obj, nil, folders.SchemeGroupVersion.WithKind("Folder"), request.NamespaceValue(ctx), "new",
			folders.SchemeGroupVersion.WithResource("folders"), "", admission.Create,
			nil, dryRun, caller,
		), nil)
	}
	if wrapper != nil {
		_, err := wrapper.Create(ctx, obj, validate, &metav1.CreateOptions{})
		return err
	}
	return validate(ctx, obj)
}

func TestFolderAPIBuilder_Validate_CreateHiddenAncestors(t *testing.T) {
	access := authz.NewClient(nil)
	for _, namespace := range []string{"default", "org-42", "stacks-42"} {
		for _, tc := range []struct {
			name           string
			root           string
			maxDepth       int
			serviceAccount bool
			wantErr        error
		}{
			{name: "at depth limit", root: "A", maxDepth: 3},
			{name: "over depth limit", root: "A", maxDepth: 2, wantErr: folder.ErrMaximumDepthReached},
			{name: "hidden k6 ancestor", root: accesscontrol.K6FolderUID, maxDepth: 5, wantErr: folder.ErrFolderCannotBeCreatedInK6},
			{name: "service account in k6 tree", root: accesscontrol.K6FolderUID, maxDepth: 5, serviceAccount: true},
		} {
			for _, dryRun := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/%s/dryRun=%t", namespace, tc.name, dryRun), func(t *testing.T) {
					ctx := ancestryTestContext(t, namespace, tc.serviceAccount)
					caller, err := identity.GetRequester(ctx)
					require.NoError(t, err)
					storage := grafanarest.NewMockStorage(t)
					storage.On("Get", mock.Anything, "C", &metav1.GetOptions{}).
						Return(ancestryTestFolder("C", "B"), nil).
						Run(func(args mock.Arguments) {
							id, err := identity.GetRequester(args.Get(0).(context.Context))
							require.NoError(t, err)
							require.Same(t, caller, id, "the immediate parent must be read as the caller")
						}).Once()
					storage.On("Get", mock.Anything, "B", &metav1.GetOptions{}).
						Return(func(lookupCtx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
							if !identity.IsServiceIdentity(lookupCtx) {
								return nil, apierrors.NewForbidden(folders.FolderResourceInfo.GroupResource(), name, errors.New("no read permission"))
							}
							id, err := identity.GetRequester(lookupCtx)
							require.NoError(t, err)
							require.Equal(t, namespace, id.GetNamespace())
							require.Equal(t, caller.GetOrgID(), id.GetOrgID())
							require.Equal(t, namespace, request.NamespaceValue(lookupCtx))
							check := authlib.CheckRequest{
								Namespace: namespace, Group: "folder.grafana.app", Resource: "folders", Verb: "get", Name: name,
							}
							res, err := access.Check(lookupCtx, id, check, tc.root)
							require.NoError(t, err)
							require.True(t, res.Allowed, "internal folder reads must be authorized, including in the k6 tree")
							check.Namespace = "org-99"
							res, err = access.Check(lookupCtx, id, check, tc.root)
							require.Error(t, err)
							require.False(t, res.Allowed, "internal identity must not authorize another namespace")
							return ancestryTestFolder("B", tc.root), nil
						}).Once()
					storage.On("Get", mock.Anything, tc.root, &metav1.GetOptions{}).
						Return(ancestryTestFolder(tc.root, ""), nil).
						Run(func(args mock.Arguments) {
							require.True(t, identity.IsServiceIdentity(args.Get(0).(context.Context)))
						}).Once()

					err = validateAncestryTestCreate(ctx, storage, tc.maxDepth, dryRun)
					if tc.wantErr != nil {
						require.ErrorIs(t, err, tc.wantErr)
					} else {
						require.NoError(t, err)
					}
					after, err := identity.GetRequester(ctx)
					require.NoError(t, err)
					require.Same(t, caller, after)
				})
			}
		}
	}
}

func TestFolderAPIBuilder_Validate_CreateAncestryErrors(t *testing.T) {
	unavailable := apierrors.NewServiceUnavailable("storage unavailable")
	for _, tc := range []struct {
		name         string
		failedFolder string
		lookupErr    error
		wantStatus   int32
	}{
		{name: "immediate parent missing", failedFolder: "C", lookupErr: apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), "C"), wantStatus: http.StatusBadRequest},
		{name: "immediate parent forbidden", failedFolder: "C", lookupErr: apierrors.NewForbidden(folders.FolderResourceInfo.GroupResource(), "C", errors.New("forbidden")), wantStatus: http.StatusBadRequest},
		{name: "grpc immediate parent missing", failedFolder: "C", lookupErr: status.Error(codes.NotFound, "private lookup"), wantStatus: http.StatusBadRequest},
		{name: "grpc immediate parent forbidden", failedFolder: "C", lookupErr: status.Error(codes.PermissionDenied, "private lookup"), wantStatus: http.StatusBadRequest},
		{name: "grandparent missing", failedFolder: "B", lookupErr: apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), "B")},
		{name: "immediate parent outage", failedFolder: "C", lookupErr: unavailable, wantStatus: http.StatusServiceUnavailable},
		{name: "grandparent outage", failedFolder: "B", lookupErr: unavailable, wantStatus: http.StatusServiceUnavailable},
		{name: "internal lookup forbidden", failedFolder: "B", lookupErr: apierrors.NewForbidden(folders.FolderResourceInfo.GroupResource(), "B", errors.New("internal lookup failed")), wantStatus: http.StatusForbidden},
		{name: "internal lookup canceled", failedFolder: "B", lookupErr: context.Canceled, wantStatus: 499},
	} {
		for _, dryRun := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/dryRun=%t", tc.name, dryRun), func(t *testing.T) {
				ctx := ancestryTestContext(t, "org-42", false)
				storage := grafanarest.NewMockStorage(t)
				if tc.failedFolder == "B" {
					storage.On("Get", mock.Anything, "C", &metav1.GetOptions{}).
						Return(ancestryTestFolder("C", "B"), nil).Once()
				}
				storage.On("Get", mock.Anything, tc.failedFolder, &metav1.GetOptions{}).
					Return(nil, tc.lookupErr).
					Run(func(args mock.Arguments) {
						require.Equal(t, tc.failedFolder == "B", identity.IsServiceIdentity(args.Get(0).(context.Context)))
					}).Once()

				err := validateAncestryTestCreate(ctx, storage, 5, dryRun)
				if tc.wantStatus == 0 || (dryRun && tc.wantStatus == http.StatusBadRequest) {
					require.NoError(t, err)
					return
				}
				require.Error(t, err)
				status := responsewriters.ErrorToAPIStatus(err)
				require.Equal(t, tc.wantStatus, status.Code)
				require.NotContains(t, status.Message, tc.lookupErr.Error(), "lookup details must not be exposed")
			})
		}
	}
}

func TestFolderAPIBuilder_Validate_CreateAncestryInvalidNamespace(t *testing.T) {
	for _, namespace := range []string{"", "*"} {
		t.Run(fmt.Sprintf("namespace=%q", namespace), func(t *testing.T) {
			ctx := ancestryTestContext(t, namespace, false)
			storage := grafanarest.NewMockStorage(t)
			storage.On("Get", mock.Anything, "C", &metav1.GetOptions{}).
				Return(ancestryTestFolder("C", "B"), nil).Once()
			err := validateAncestryTestCreate(ctx, storage, 5, false)
			require.Error(t, err)
			require.Equal(t, int32(http.StatusInternalServerError), responsewriters.ErrorToAPIStatus(err).Code)
		})
	}
}

func TestParentsLookupRemainsCallerBound(t *testing.T) {
	ctx := ancestryTestContext(t, "org-42", false)
	caller, err := identity.GetRequester(ctx)
	require.NoError(t, err)
	storage := grafanarest.NewMockStorage(t)
	denied := apierrors.NewForbidden(folders.FolderResourceInfo.GroupResource(), "B", errors.New("no read permission"))
	storage.On("Get", mock.Anything, "B", &metav1.GetOptions{}).
		Return(nil, denied).
		Run(func(args mock.Arguments) {
			id, err := identity.GetRequester(args.Get(0).(context.Context))
			require.NoError(t, err)
			require.Same(t, caller, id)
		}).Once()

	parents, err := newParentsGetter(storage)(ctx, ancestryTestFolder("C", "B"))
	require.NoError(t, err)
	require.Equal(t, []folders.FolderInfo{
		{Name: "B", Detached: true, Description: "Unable to read parent folder"},
		{Name: "C", Title: "C", Parent: "B"},
	}, parents.Items)
}

func TestCreateParentsPreservesRequestContext(t *testing.T) {
	type contextKey struct{}
	ctx := context.WithValue(ancestryTestContext(t, "org-42", false), contextKey{}, "request value")
	ctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	storage := grafanarest.NewMockStorage(t)
	storage.On("Get", mock.Anything, "C", &metav1.GetOptions{}).
		Return(ancestryTestFolder("C", "B"), nil).Once()
	storage.On("Get", mock.Anything, "B", &metav1.GetOptions{}).
		Return(func(lookupCtx context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
			require.True(t, identity.IsServiceIdentity(lookupCtx))
			require.Equal(t, "request value", lookupCtx.Value(contextKey{}))
			deadline, ok := ctx.Deadline()
			require.True(t, ok)
			lookupDeadline, ok := lookupCtx.Deadline()
			require.True(t, ok)
			require.Equal(t, deadline, lookupDeadline)
			cancel()
			require.ErrorIs(t, lookupCtx.Err(), context.Canceled)
			return nil, lookupCtx.Err()
		}).Once()

	_, err := newCreateParentsGetter(storage)(ctx, ancestryTestFolder("new", "C"))
	require.Error(t, err)
	require.Equal(t, int32(499), responsewriters.ErrorToAPIStatus(err).Code)
}

func ancestryTestStorageWrapper(t *testing.T, wrapped bool) *folderStorage {
	t.Helper()
	if !wrapped {
		return nil
	}
	store := grafanarest.NewMockStorage(t)
	store.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(func(ctx context.Context, obj runtime.Object, validation rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
			return nil, validation(ctx, obj)
		}).Once()
	return &folderStorage{store: store}
}

func TestCreateLookupFailuresPreserveStatusWithoutDiagnostics(t *testing.T) {
	const private = "PRIVATE_LOOKUP_DIAGNOSTIC"
	detailed, err := status.New(codes.DeadlineExceeded, private).WithDetails(&resourcepb.ErrorResult{
		Code: 504, Message: private, Details: &resourcepb.ErrorDetails{Name: private, RetryAfterSeconds: 7},
	})
	require.NoError(t, err)
	canceled, err := status.New(codes.Canceled, private).WithDetails(&resourcepb.ErrorResult{
		Code: 499, Message: private, Details: &resourcepb.ErrorDetails{Name: private, RetryAfterSeconds: 7},
	})
	require.NoError(t, err)
	throttled, err := status.New(codes.ResourceExhausted, private).WithDetails(&resourcepb.ErrorResult{
		Code: 429, Message: private, Details: &resourcepb.ErrorDetails{Name: private, RetryAfterSeconds: 7},
	})
	require.NoError(t, err)
	tests := []struct {
		name  string
		err   error
		code  int
		retry string
	}{
		{"plain", errors.New(private), 500, ""},
		{"internal status", apierrors.NewInternalError(errors.New(private)), 500, ""},
		{"unavailable", apierrors.NewServiceUnavailable(private), 503, ""},
		{"throttled", apierrors.NewTooManyRequests(private, 7), 429, "7"},
		{"grpc unavailable", status.Error(codes.Unavailable, private), 503, ""},
		{"grpc deadline details", detailed.Err(), 504, "7"},
		{"wrapped grpc deadline details", fmt.Errorf("%s: %w", private, detailed.Err()), 504, "7"},
		{"grpc canceled details", canceled.Err(), 499, "7"},
		{"wrapped grpc canceled details", fmt.Errorf("%s: %w", private, canceled.Err()), 499, "7"},
		{"grpc throttled", status.Error(codes.ResourceExhausted, private), 429, ""},
		{"grpc throttled details", throttled.Err(), 429, "7"},
		{"canceled", fmt.Errorf("%s: %w", private, context.Canceled), 499, ""},
		{"deadline", context.DeadlineExceeded, 504, ""},
	}
	for _, tc := range tests {
		for _, ancestor := range []bool{false, true} {
			for _, dryRun := range []bool{false, true} {
				for _, wrapped := range []bool{false, true} {
					t.Run(fmt.Sprintf("%s/ancestor=%t/dryRun=%t/wrapped=%t", tc.name, ancestor, dryRun, wrapped), func(t *testing.T) {
						store := grafanarest.NewMockStorage(t)
						failed := "C"
						if ancestor {
							store.On("Get", mock.Anything, "C", mock.Anything).Return(ancestryTestFolder("C", "B"), nil).Once()
							failed = "B"
						}
						store.On("Get", mock.Anything, failed, mock.Anything).Return(nil, tc.err).Once()
						err := validateAncestryTestCreateThroughStorage(ancestryTestContext(t, "org-42", false), store, 5, dryRun, ancestryTestStorageWrapper(t, wrapped))
						require.Error(t, err)
						w := httptest.NewRecorder()
						responsewriters.ErrorNegotiated(err, scheme.Codecs, schema.GroupVersion{Version: "v1"}, w, httptest.NewRequest(http.MethodPost, "/folders", nil))
						require.Equal(t, tc.code, w.Code)
						require.Equal(t, tc.retry, w.Header().Get("Retry-After"))
						require.NotContains(t, w.Body.String(), private)
					})
				}
			}
		}
	}
}

func TestCreateReasonOnlyLookupErrors(t *testing.T) {
	const private = "PRIVATE_LOOKUP_DIAGNOSTIC"
	for _, tc := range []struct {
		name     string
		reason   metav1.StatusReason
		ancestor bool
		code     int
	}{
		{"missing parent", metav1.StatusReasonNotFound, false, 400},
		{"forbidden parent", metav1.StatusReasonForbidden, false, 400},
		{"missing ancestor", metav1.StatusReasonNotFound, true, 0},
		{"forbidden ancestor", metav1.StatusReasonForbidden, true, 403},
	} {
		for _, dryRun := range []bool{false, true} {
			for _, wrapped := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/dryRun=%t/wrapped=%t", tc.name, dryRun, wrapped), func(t *testing.T) {
					store := grafanarest.NewMockStorage(t)
					failed := "C"
					if tc.ancestor {
						store.On("Get", mock.Anything, "C", mock.Anything).Return(ancestryTestFolder("C", "B"), nil).Once()
						failed = "B"
					}
					lookupErr := resource.StatusError(&resourcepb.ErrorResult{Reason: string(tc.reason), Message: private})
					store.On("Get", mock.Anything, failed, mock.Anything).Return(nil, lookupErr).Once()
					err := validateAncestryTestCreateThroughStorage(ancestryTestContext(t, "org-42", false), store, 5, dryRun, ancestryTestStorageWrapper(t, wrapped))
					if tc.code == 0 || (dryRun && !tc.ancestor) {
						require.NoError(t, err)
						return
					}
					require.Error(t, err)
					w := httptest.NewRecorder()
					responsewriters.ErrorNegotiated(err, scheme.Codecs, schema.GroupVersion{Version: "v1"}, w, httptest.NewRequest(http.MethodPost, "/folders", nil))
					require.Equal(t, tc.code, w.Code)
					require.NotContains(t, w.Body.String(), private)
				})
			}
		}
	}
}

func TestCreateValidationPreservesPublicIdentityThroughStorage(t *testing.T) {
	for _, wrapped := range []bool{false, true} {
		t.Run(fmt.Sprintf("wrapped=%t", wrapped), func(t *testing.T) {
			store := grafanarest.NewMockStorage(t)
			store.On("Get", mock.Anything, "C", mock.Anything).Return(ancestryTestFolder("C", "B"), nil).Once()
			store.On("Get", mock.Anything, "B", mock.Anything).Return(ancestryTestFolder("B", ""), nil).Once()
			err := validateAncestryTestCreateThroughStorage(ancestryTestContext(t, "org-42", false), store, 1, false, ancestryTestStorageWrapper(t, wrapped))
			require.Error(t, err)
			public := responsewriters.ErrorToAPIStatus(err)
			require.Equal(t, int32(400), public.Code)
			if wrapped {
				require.Equal(t, "[folder.maximum-depth-reached] folder max depth exceeded, max depth is 1", public.Message)
			} else {
				require.Equal(t, "Maximum nested folder depth reached", public.Message)
			}
			require.NotNil(t, public.Details)
			require.Equal(t, "folder.maximum-depth-reached", string(public.Details.UID))
		})
	}
}

func TestFolderAPIBuilder_Validate_CreateAncestryWrongType(t *testing.T) {
	ctx := ancestryTestContext(t, "default", false)
	storage := grafanarest.NewMockStorage(t)
	storage.On("Get", mock.Anything, "C", &metav1.GetOptions{}).
		Return(&unstructured.Unstructured{}, nil).Once()
	err := validateAncestryTestCreate(ctx, storage, 5, false)
	require.Error(t, err)
	require.Equal(t, int32(http.StatusInternalServerError), responsewriters.ErrorToAPIStatus(err).Code)
}
