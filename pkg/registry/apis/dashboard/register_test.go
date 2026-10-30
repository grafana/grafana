package dashboard

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/gorilla/mux"
	authlib "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/admission"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	kubecommon "k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis"
	dashinternal "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/snapshot"
	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	apiserverbuilder "github.com/grafana/grafana/pkg/services/apiserver/builder"
	apiserverrequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/restoptions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestDashboardAPIBuilder_Validate(t *testing.T) {
	oneInt64 := int64(1)
	zeroInt64 := int64(0)

	classicFP := map[string]string{
		utils.AnnoKeyManagerKind:     string(utils.ManagerKindClassicFP), //nolint:staticcheck
		utils.AnnoKeyManagerIdentity: "some-provisioner",
	}
	newDashboard := func(annotations map[string]string) *dashv1.Dashboard {
		return &dashv1.Dashboard{
			Spec:       common.Unstructured{},
			TypeMeta:   metav1.TypeMeta{Kind: "Dashboard"},
			ObjectMeta: metav1.ObjectMeta{Name: "test", Annotations: annotations},
		}
	}

	tests := []struct {
		name             string
		existingObj      runtime.Object
		collectionDelete bool
		deletionOptions  metav1.DeleteOptions
		expectedError    bool
		expectBadRequest bool
	}{
		{
			name:             "should block deletion of provisioned dashboard (classic file provisioning)",
			existingObj:      newDashboard(classicFP),
			deletionOptions:  metav1.DeleteOptions{GracePeriodSeconds: nil},
			expectedError:    true,
			expectBadRequest: true,
		},
		{
			name:            "should return an error if the existing dashboard is missing",
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: nil},
			expectedError:   true,
		},
		{
			name:            "should allow deletion of non-provisioned dashboard",
			existingObj:     newDashboard(nil),
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: nil},
			expectedError:   false,
		},
		{
			name: "should allow deletion of dashboard managed by a non-classic-FP manager",
			existingObj: newDashboard(map[string]string{
				utils.AnnoKeyManagerKind:     "some-other-manager",
				utils.AnnoKeyManagerIdentity: "some-identity",
			}),
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: nil},
			expectedError:   false,
		},
		{
			name:             "should still run the check for delete if grace period is not 0",
			existingObj:      newDashboard(classicFP),
			deletionOptions:  metav1.DeleteOptions{GracePeriodSeconds: &oneInt64},
			expectedError:    true,
			expectBadRequest: true,
		},
		{
			name:            "should not run the check for delete if grace period is set to 0",
			existingObj:     newDashboard(classicFP),
			deletionOptions: metav1.DeleteOptions{GracePeriodSeconds: &zeroInt64},
			expectedError:   false,
		},
		{
			name:             "should not run the check for DeleteCollection requests",
			existingObj:      newDashboard(classicFP),
			collectionDelete: true,
			deletionOptions:  metav1.DeleteOptions{GracePeriodSeconds: nil},
			expectedError:    false,
		},
	}
	for _, standalone := range []bool{false, true} {
		for _, tt := range tests {
			t.Run(fmt.Sprintf("standalone=%t/%s", standalone, tt.name), func(t *testing.T) {
				name := "test"
				if tt.collectionDelete {
					name = ""
				}

				b := &DashboardsAPIBuilder{isStandalone: standalone}
				err := b.Validate(context.Background(), admission.NewAttributesRecord(
					nil,
					tt.existingObj,
					dashv1.DashboardResourceInfo.GroupVersionKind(),
					"stacks-123",
					name,
					dashv1.DashboardResourceInfo.GroupVersionResource(),
					"",
					admission.Operation("DELETE"),
					&tt.deletionOptions,
					true,
					&user.SignedInUser{},
				), nil)

				if tt.expectedError {
					require.Error(t, err)
				} else {
					require.NoError(t, err)
				}
				if tt.expectBadRequest {
					require.True(t, apierrors.IsBadRequest(err), "expected a 400, got %v", err)
					require.EqualError(t, err, dashboards.ErrDashboardCannotDeleteProvisionedDashboard.Reason)
				}
			})
		}
	}
}

func TestDashboardAPIBuilder_StandaloneLibraryPanelAdmissionEnforcesAccess(t *testing.T) {
	requester := &identity.StaticRequester{
		Type:      authlib.TypeServiceAccount,
		UserID:    42,
		UserUID:   "viewer-service-account",
		OrgID:     1,
		Namespace: "stacks-1",
	}

	tests := []struct {
		name           string
		operation      admission.Operation
		expectedVerb   string
		folderUID      string
		expectedFolder string
	}{
		{
			name:           "create in a folder",
			operation:      admission.Create,
			expectedVerb:   utils.VerbCreate,
			folderUID:      "folder-a",
			expectedFolder: "folder-a",
		},
		{
			name:           "update at the root",
			operation:      admission.Update,
			expectedVerb:   utils.VerbUpdate,
			expectedFolder: accesscontrol.GeneralFolderUID,
		},
		{
			name:           "delete from a folder",
			operation:      admission.Delete,
			expectedVerb:   utils.VerbDelete,
			folderUID:      "folder-b",
			expectedFolder: "folder-b",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotIdentity authlib.AuthInfo
			var gotRequest authlib.CheckRequest
			var gotFolder string
			accessClient := &recordingAccessClient{
				check: func(_ context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
					gotIdentity = info
					gotRequest = req
					gotFolder = folder
					return authlib.CheckResponse{Allowed: false, Zookie: authlib.NoopZookie{}}, nil
				},
			}
			dashboardBuilder := NewAPIService(
				accessClient,
				nil,
				testutil.NewDataSourceProvider(testutil.StandardTestConfig),
				testutil.NewLibraryElementProvider(),
				nil,
				nil,
				nil,
			)
			require.True(t, dashboardBuilder.isStandalone)
			admissionPlugin := apiserverbuilder.NewAdmissionFromBuilders([]apiserverbuilder.APIGroupBuilder{dashboardBuilder})

			panel := &dashv0.LibraryPanel{
				TypeMeta: metav1.TypeMeta{
					APIVersion: dashv0.LibraryPanelResourceInfo.GroupVersion().String(),
					Kind:       dashv0.LibraryPanelResourceInfo.GroupVersionKind().Kind,
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:      "panel-a",
					Namespace: "stacks-1",
				},
			}
			if tt.folderUID != "" {
				panel.SetAnnotations(map[string]string{utils.AnnoKeyFolder: tt.folderUID})
			}

			var object, oldObject runtime.Object
			switch tt.operation {
			case admission.Delete:
				oldObject = panel
			case admission.Update:
				object = panel
				oldObject = panel.DeepCopy()
			default:
				object = panel
			}
			ctx := identity.WithRequester(context.Background(), requester)
			err := admissionPlugin.Validate(ctx, admission.NewAttributesRecord(
				object,
				oldObject,
				dashv0.LibraryPanelResourceInfo.GroupVersionKind(),
				"stacks-1",
				panel.Name,
				dashv0.LibraryPanelResourceInfo.GroupVersionResource(),
				"",
				tt.operation,
				nil,
				false,
				requester,
			), nil)

			require.True(t, apierrors.IsForbidden(err), "standalone admission must reject a denied %s", tt.operation)
			require.Same(t, requester, gotIdentity)
			require.Equal(t, authlib.CheckRequest{
				Verb:      tt.expectedVerb,
				Group:     dashv0.LibraryPanelResourceInfo.GroupVersionResource().Group,
				Resource:  dashv0.LibraryPanelResourceInfo.GroupVersionResource().Resource,
				Namespace: "stacks-1",
				Name:      "panel-a",
			}, gotRequest)
			require.Equal(t, tt.expectedFolder, gotFolder)
		})
	}
}

func TestDashboardAPIBuilder_EmbeddedLibraryPanelFinalStorageKeepsAccessBoundary(t *testing.T) {
	scheme := runtime.NewScheme()
	require.NoError(t, dashv0.AddToScheme(scheme))
	codecs := serializer.NewCodecFactory(scheme)
	optsGetter, err := restoptions.NewRESTOptionsGetterMemory(storagebackend.Config{
		Codec: codecs.LegacyCodec(dashv0.LibraryPanelResourceInfo.GroupVersion()),
	}, nil)
	require.NoError(t, err)

	tests := []struct {
		name          string
		selectStorage func(legacy, unified grafanarest.Storage) grafanarest.Storage
	}{
		{
			name: "legacy storage selected",
			selectStorage: func(legacy, _ grafanarest.Storage) grafanarest.Storage {
				return legacy
			},
		},
		{
			name: "unified storage selected",
			selectStorage: func(_, unified grafanarest.Storage) grafanarest.Storage {
				return unified
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var selectedStorage grafanarest.Storage
			builder := &DashboardsAPIBuilder{
				iamFeatures: iamapi.Features{ResourcePermissionsAPI: true},
			}
			groupInfo := &genericapiserver.APIGroupInfo{
				VersionedResourcesStorageMap: map[string]map[string]rest.Storage{},
			}
			err := builder.storageForVersion(
				groupInfo,
				apiserverbuilder.APIGroupOptions{
					Scheme:     scheme,
					OptsGetter: optsGetter,
					DualWriteBuilder: func(_ schema.GroupResource, legacy, unified grafanarest.Storage) (grafanarest.Storage, error) {
						selectedStorage = tt.selectStorage(legacy, unified)
						return selectedStorage, nil
					},
				},
				dashv0.DashboardResourceInfo,
				&dashv0.LibraryPanelResourceInfo,
				nil,
				func(runtime.Object, *dashinternal.DashboardAccess) (runtime.Object, error) {
					return &dashv0.DashboardWithAccessInfo{}, nil
				},
			)
			require.NoError(t, err)

			versionStorage := groupInfo.VersionedResourcesStorageMap[dashv0.LibraryPanelResourceInfo.GroupVersion().Version]
			installedStorage := versionStorage[dashv0.LibraryPanelResourceInfo.StoragePath()]
			var wrapper *libraryPanelAccessStorage
			switch typed := installedStorage.(type) {
			case *libraryPanelAccessStorage:
				wrapper = typed
			case *libraryPanelAccessStorageWithWatch:
				wrapper = typed.libraryPanelAccessStorage
			}
			ok := wrapper != nil
			require.True(t, ok)
			require.Same(t, selectedStorage, wrapper.store)

			_, dashboardWrapped := versionStorage[dashv0.DashboardResourceInfo.StoragePath()].(*libraryPanelAccessStorage)
			require.False(t, dashboardWrapped, "library panel authorization must not wrap dashboard storage")
		})
	}
}

func TestDashboardAPIBuilder_LibraryPanelFolderValidationForProvisioningIdentity(t *testing.T) {
	ctx, _, err := identity.WithProvisioningIdentity(t.Context(), "stacks-1")
	require.NoError(t, err)
	ctx = k8srequest.WithNamespace(ctx, "stacks-1")
	missingFolderBuilder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{notFoundAccessSubresource: true}},
	}

	t.Run("allows a repository managed resource when the folder is not visible yet", func(t *testing.T) {
		panel := testLibraryPanel("panel-a", "provisioned-folder")
		accessor, err := utils.MetaAccessor(panel)
		require.NoError(t, err)
		accessor.SetManagerProperties(utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "library-panels-repo",
		})

		require.NoError(t, missingFolderBuilder.validateLibraryPanelFolder(ctx, panel))
	})

	t.Run("still rejects an unmanaged resource with a missing folder", func(t *testing.T) {
		err := missingFolderBuilder.validateLibraryPanelFolder(ctx, testLibraryPanel("panel-a", "missing-folder"))
		require.True(t, apierrors.IsNotFound(err))
	})
}

func TestDashboardAPIBuilder_StandaloneLibraryPanelMoveRequiresSourceAndDestinationAccess(t *testing.T) {
	requester := &identity.StaticRequester{
		Type:      authlib.TypeServiceAccount,
		UserID:    42,
		UserUID:   "folder-limited-service-account",
		OrgID:     1,
		Namespace: "stacks-1",
	}
	type authorizationCheck struct {
		verb   string
		folder string
	}
	checks := make([]authorizationCheck, 0, 2)
	accessClient := &recordingAccessClient{
		check: func(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			checks = append(checks, authorizationCheck{verb: req.Verb, folder: folder})
			return authlib.CheckResponse{
				Allowed: req.Verb == utils.VerbUpdate && folder == "source-folder",
				Zookie:  authlib.NoopZookie{},
			}, nil
		},
	}
	dashboardBuilder := NewAPIService(
		accessClient,
		nil,
		testutil.NewDataSourceProvider(testutil.StandardTestConfig),
		testutil.NewLibraryElementProvider(),
		nil,
		nil,
		nil,
	)
	admissionPlugin := apiserverbuilder.NewAdmissionFromBuilders([]apiserverbuilder.APIGroupBuilder{dashboardBuilder})

	oldPanel := &dashv0.LibraryPanel{ObjectMeta: metav1.ObjectMeta{
		Name:        "panel-a",
		Namespace:   "stacks-1",
		Annotations: map[string]string{utils.AnnoKeyFolder: "source-folder"},
	}}
	updatedPanel := oldPanel.DeepCopy()
	updatedPanel.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "destination-folder"})
	ctx := identity.WithRequester(context.Background(), requester)
	err := admissionPlugin.Validate(ctx, admission.NewAttributesRecord(
		updatedPanel,
		oldPanel,
		dashv0.LibraryPanelResourceInfo.GroupVersionKind(),
		"stacks-1",
		updatedPanel.Name,
		dashv0.LibraryPanelResourceInfo.GroupVersionResource(),
		"",
		admission.Update,
		nil,
		false,
		requester,
	), nil)

	require.True(t, apierrors.IsForbidden(err), "moving a panel must require destination-folder access")
	require.Equal(t, []authorizationCheck{
		{verb: utils.VerbUpdate, folder: "source-folder"},
		{verb: utils.VerbCreate, folder: "destination-folder"},
	}, checks)
}

type recordingAccessClient struct {
	check func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error)
}

func TestValidateLibraryPanelDeleteChecksUnifiedReferences(t *testing.T) {
	tests := []struct {
		name      string
		totalHits int64
		forbidden bool
	}{
		{name: "unreferenced panel", totalHits: 0},
		{name: "connected panel", totalHits: 1, forbidden: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var captured *resourcepb.ResourceSearchRequest
			client := &recordingResourceClient{search: func(ctx context.Context, request *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
				require.True(t, identity.IsServiceIdentity(ctx), "referential-integrity search must include hidden dashboards")
				requester, err := identity.GetRequester(ctx)
				require.NoError(t, err)
				require.Equal(t, "stacks-1", requester.GetNamespace())
				captured = request
				return &resourcepb.ResourceSearchResponse{TotalHits: tt.totalHits}, nil
			}}
			builder := &DashboardsAPIBuilder{unified: client}

			err := builder.validateLibraryPanelDelete(context.Background(), "panel-a", "stacks-1")
			if tt.forbidden {
				require.True(t, apierrors.IsForbidden(err))
			} else {
				require.NoError(t, err)
			}
			require.NotNil(t, captured)
			require.Equal(t, int64(1), captured.Limit)
			require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, captured.ResultFormat)
			require.Equal(t, []string{resource.SEARCH_FIELD_NAME}, captured.Fields)
			require.Equal(t, "stacks-1", captured.Options.Key.Namespace)
			require.Equal(t, dashv0.DASHBOARD_RESOURCE, captured.Options.Key.Resource)
			require.Equal(t, builders.DASHBOARD_LIBRARY_PANEL_REFERENCE, captured.Options.Fields[0].Key)
			require.Equal(t, []string{"panel-a"}, captured.Options.Fields[0].Values)
		})
	}
}

type recordingResourceClient struct {
	resource.ResourceClient
	search func(context.Context, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
}

func (c *recordingResourceClient) Search(ctx context.Context, request *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	return c.search(ctx, request)
}

func (c *recordingAccessClient) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return c.check(ctx, info, req, folder)
}

func (c *recordingAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, authlib.NoopZookie{}, nil
}

func (c *recordingAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, _ authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}

// TestCodecPathResourcesRegisterOneVersionPerType guards apimachinery's LegacyCodec version-order
// fallback (see assertNoTypeSpansMultipleGVKs).
func TestCodecPathResourcesRegisterOneVersionPerType(t *testing.T) {
	migration.ResetForTesting()
	migration.Initialize(testutil.NewDataSourceProvider(testutil.StandardTestConfig), testutil.NewLibraryElementProvider(), migration.DefaultCacheTTL)

	scheme := runtime.NewScheme()
	b := &DashboardsAPIBuilder{}
	require.NoError(t, b.InstallSchema(scheme))

	assertNoTypeSpansMultipleGVKs(t, scheme)
}

// commonMultiVersionTypes are known-safe exceptions to assertNoTypeSpansMultipleGVKs: k8s bookkeeping
// types every group-version registers by convention (never round-trip through Storage.Create), plus
// v1beta1's documented type aliases to v1 (Dashboard's StorageOptions sets Scheme, so it never takes
// the codec path, and declares a per-version GVK, so the shared type cannot resolve to the wrong
// version either; DashboardWithAccessInfo is a read-only /dto response, also never written).
// Add here on exception basis with a description.
var commonMultiVersionTypes = func() map[reflect.Type]bool {
	m := map[reflect.Type]bool{}
	for _, o := range []runtime.Object{
		&metav1.WatchEvent{}, &metav1.InternalEvent{}, &metav1.ListOptions{}, &metav1.GetOptions{},
		&metav1.DeleteOptions{}, &metav1.CreateOptions{}, &metav1.UpdateOptions{}, &metav1.PatchOptions{},
		&metav1.PartialObjectMetadata{}, &metav1.PartialObjectMetadataList{},
		&dashv1.Dashboard{}, &dashv1.DashboardList{}, &dashv1.DashboardWithAccessInfo{},
	} {
		m[reflect.TypeOf(o).Elem()] = true
	}
	return m
}()

// assertNoTypeSpansMultipleGVKs fails if any type a real InstallSchema registers has 2+
// GroupVersionKinds, or is registered at runtime.APIVersionInternal at all. Either shape activates
// apimachinery's LegacyCodec order-fallback (a type sharing a GVK with the internal version, or with
// another external version, has no exact match in the codec's version list), which would let
// preferred_api_version silently pick the persisted version instead of only discovery order. A
// same-struct hub isn't required: a distinct internal-only struct plus distinct external structs hits
// the same fallback, since the fallback keys on the object's own GVK never exactly matching the
// codec's target list, not on the Go type being reused. Walks every registered type rather than a
// hardcoded list, so a new resource is covered too.
func assertNoTypeSpansMultipleGVKs(t *testing.T, scheme *runtime.Scheme) {
	t.Helper()
	byType := map[reflect.Type][]schema.GroupVersionKind{}
	for gvk, typ := range scheme.AllKnownTypes() {
		if commonMultiVersionTypes[typ] {
			continue
		}
		obj, ok := reflect.TypeAssert[runtime.Object](reflect.New(typ))
		if !ok {
			continue
		}
		if unversioned, ok := scheme.IsUnversioned(obj); ok && unversioned {
			continue // e.g. metav1.Status - genuinely version-independent, not a codec-fallback risk
		}
		require.NotEqualf(t, runtime.APIVersionInternal, gvk.Version,
			"%s is registered at the internal version (%v) - a hub type never exactly matches any "+
				"external version in the LegacyCodec's list, so encoding it always hits the "+
				"order-fallback and lets preferred_api_version pick the persisted version", typ, gvk)
		byType[typ] = append(byType[typ], gvk)
	}
	for typ, gvks := range byType {
		require.Lenf(t, gvks, 1,
			"%s is registered at %v - a Go type shared across group versions activates the LegacyCodec "+
				"order-fallback, so preferred_api_version would now silently pick the persisted version "+
				"for this type instead of only ordering API discovery", typ, gvks)
	}
}

// gvkRecorder captures the GVK each store's storage options declare.
type gvkRecorder struct {
	recorded []apistore.StorageOptions
}

func (r *gvkRecorder) GetRESTOptions(schema.GroupResource, runtime.Object) (generic.RESTOptions, error) {
	return generic.RESTOptions{}, nil
}

func (r *gvkRecorder) WithStorageOptions(opts apistore.StorageOptions) generic.RESTOptionsGetter {
	r.recorded = append(r.recorded, opts)
	return r
}

// Every dashboard version installs its own store against the one shared
// GroupResource, so the version a store persists as can only come from its
// declared GVK. It matters most for v1beta1 and v1: they are the same Go type
// (see commonMultiVersionTypes), so nothing about the type itself tells the two
// stores apart.
func TestDashboardStorageDeclaresPerVersionGVK(t *testing.T) {
	recorder := &gvkRecorder{}
	opts := apiserverbuilder.APIGroupOptions{
		Scheme:     runtime.NewScheme(),
		OptsGetter: recorder,
	}
	// Standalone keeps dashboardStorageOpts off the feature toggles and the
	// legacy permission service, which a bare builder does not have.
	b := &DashboardsAPIBuilder{isStandalone: true}

	for _, info := range []utils.ResourceInfo{
		dashv0.DashboardResourceInfo,
		dashv1beta1.DashboardResourceInfo,
		dashv1.DashboardResourceInfo,
		dashv2alpha1.DashboardResourceInfo,
		dashv2beta1.DashboardResourceInfo,
		dashv2.DashboardResourceInfo,
	} {
		opts.StorageOptsGetterFor(info, b.dashboardStorageOpts())
	}

	got := make([]schema.GroupVersionKind, 0, len(recorder.recorded))
	for _, so := range recorder.recorded {
		got = append(got, so.GVK)
		// The options every version shares must survive being paired per version.
		require.True(t, so.EnableFolderSupport, "%s lost folder support", so.GVK)
		require.Equal(t, apistore.DeprecatedID_Required, so.DeprecatedInternalID, "%s lost the internal ID", so.GVK)
		require.NotNil(t, so.Permissions, "%s lost its default permission setter", so.GVK)
	}

	group := dashv0.DashboardResourceInfo.GroupResource().Group
	require.Equal(t, []schema.GroupVersionKind{
		{Group: group, Version: "v0alpha1", Kind: "Dashboard"},
		{Group: group, Version: "v1beta1", Kind: "Dashboard"},
		{Group: group, Version: "v1", Kind: "Dashboard"},
		{Group: group, Version: "v2alpha1", Kind: "Dashboard"},
		{Group: group, Version: "v2beta1", Kind: "Dashboard"},
		{Group: group, Version: "v2", Kind: "Dashboard"},
	}, got, "each version declares itself, and v1 is not conflated with v1beta1")
}

func TestLegacyOnlySnapshotCreateAfterModeChanges(t *testing.T) {
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagSnapshotsKubernetesSnapshots: {
			Key: featuremgmt.FlagSnapshotsKubernetesSnapshots, DefaultVariant: "enabled",
			Variants: map[string]any{"enabled": true},
		},
	})))
	t.Cleanup(func() { _ = openfeature.SetProviderAndWait(openfeature.NoopProvider{}) })

	service := dashboardsnapshots.NewMockService(t)
	service.On("CreateDashboardSnapshot", mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			cmd := args.Get(1).(*dashboardsnapshots.CreateDashboardSnapshotCommand)
			require.Equal(t, "CPU", cmd.Dashboard.Object["title"])
		}).Return(&dashboardsnapshots.DashboardSnapshot{
		Key: "snap-1", OrgID: 1, Dashboard: simplejson.New(),
		Created: time.Now(), Updated: time.Now(), Expires: time.Now().Add(time.Hour),
	}, nil)
	legacy := &snapshot.SnapshotLegacyStore{
		ResourceInfo: dashv0.SnapshotResourceInfo, Service: service,
		Namespacer: authlib.OrgNamespaceFormatter,
	}
	mode := dualwrite.NewMockService(t)
	mode.On("ReadFromUnified", mock.Anything, dashv0.SnapshotResourceInfo.GroupResource()).Return(true, nil).Maybe()
	b := &DashboardsAPIBuilder{snapshotStorage: legacy, dualWriter: mode}
	blobs := resource.NewMockResourceClient(t)
	dashboardService := dashboards.NewFakeDashboardService(t)
	dashboardService.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{
		UID: "dash-1", OrgID: 1,
	}).Return(&dashboards.Dashboard{UID: "dash-1", OrgID: 1}, nil)
	routes := snapshot.GetRoutes(
		dashv0.SnapshotSharingOptions{SnapshotsEnabled: true},
		acmock.New().WithPermissions([]accesscontrol.Permission{
			{Action: dashboards.ActionSnapshotsCreate},
			{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:dash-1"},
		}),
		map[string]kubecommon.OpenAPIDefinition{},
		func() rest.Storage { return b.snapshotStorage }, dashboardService, blobs, b.snapshotReadFromUnified,
	)
	body := []byte(`{"dashboard":{"uid":"dash-1","title":"CPU"},"name":"legacy snapshot"}`)
	req := httptest.NewRequest(http.MethodPost, "/snapshots/create", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{UserID: 1, OrgID: 1}))
	req = mux.SetURLVars(req, map[string]string{"namespace": "default"})
	response := httptest.NewRecorder()
	routes.Namespace[0].Handler(response, req)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	blobs.AssertNotCalled(t, "PutBlob", mock.Anything, mock.Anything)
}

func TestSnapshotBlobEligibilityWithLegacyOnlyStore(t *testing.T) {
	mode := dualwrite.NewMockService(t)
	b := &DashboardsAPIBuilder{
		snapshotStorage: &snapshot.SnapshotLegacyStore{},
		dualWriter:      mode,
	}

	// Even if another instance finishes migration, this instance retains its legacy-only store.
	enabled, err := b.snapshotReadFromUnified(context.Background())
	require.NoError(t, err)
	require.False(t, enabled)

	b.snapshotStorage = grafanarest.NewMockStorage(t)
	mode.On("ReadFromUnified", context.Background(), dashv0.SnapshotResourceInfo.GroupResource()).Return(true, nil)
	enabled, err = b.snapshotReadFromUnified(context.Background())
	require.NoError(t, err)
	require.True(t, enabled)
}

// Library panels are keyed by their own GroupResource and served only in
// v0alpha1, so their store declares that kind rather than a dashboard one.
func TestLibraryPanelStorageDeclaresGVK(t *testing.T) {
	recorder := &gvkRecorder{}
	opts := apiserverbuilder.APIGroupOptions{
		Scheme:     runtime.NewScheme(),
		OptsGetter: recorder,
	}
	b := &DashboardsAPIBuilder{}

	info := dashv0.LibraryPanelResourceInfo
	opts.StorageOptsGetterFor(info, b.libraryPanelStorageOpts())

	require.Len(t, recorder.recorded, 1)
	so := recorder.recorded[0]
	require.Equal(t, info.GroupVersionKind(), so.GVK)
	require.Equal(t, "LibraryPanel", so.GVK.Kind)
	require.True(t, so.EnableFolderSupport, "panels are synced into managed folders")
	require.False(t, so.RequireFolder, "panels may live at the root")
	require.Equal(t, apistore.DeprecatedID_Optional, so.DeprecatedInternalID,
		"Mode 1 must preserve the SQL ID when copying a panel to unified storage")

	standalone := (&DashboardsAPIBuilder{isStandalone: true}).libraryPanelStorageOpts()
	require.Equal(t, apistore.DeprecatedID_None, standalone.DeprecatedInternalID,
		"standalone writes must not accept client-supplied SQL IDs")
}

// The remaining resources in the group -- variables, notebooks and snapshots --
// are each served by a single version, but they share the dashboard group with
// six dashboard versions. Nothing about a stored object's group says which kind
// it is, so each of these has to declare its own GVK or the codec would be free
// to persist it under some other kind in the group.
// TestSnapshotRegistrationFiltersEveryServedVersion is a registration-level guard:
// it discovers every served Snapshot version from the manifest, exercises the GET
// and LIST endpoints actually registered for that version, and verifies the
// ownership filtering and sensitive-field stripping are applied. A newly served
// Snapshot version is picked up automatically and fails here if its registration
// or access wrapper is missing.
func TestSnapshotRegistrationFiltersEveryServedVersion(t *testing.T) {
	snapshotKind := dashv0.SnapshotResourceInfo.GroupVersionKind().Kind

	servedSnapshotVersions := map[string]bool{}
	for _, v := range apis.LocalManifest().ManifestData.Versions {
		if !v.Served {
			continue
		}
		for _, k := range v.Kinds {
			if k.Kind == snapshotKind {
				servedSnapshotVersions[v.Name] = true
			}
		}
	}
	require.NotEmpty(t, servedSnapshotVersions, "expected at least one served Snapshot version in the manifest")

	// Each served Snapshot version must be wired here. A new served version with no
	// entry fails this guard, forcing its registration and access wrapper to be added.
	type versionWiring struct {
		dashboards utils.ResourceInfo
		snapshots  *utils.ResourceInfo
	}
	wiring := map[string]versionWiring{
		dashv0.VERSION: {dashv0.DashboardResourceInfo, &dashv0.SnapshotResourceInfo},
	}

	names := func(list *dashv0.SnapshotList) []string {
		out := make([]string, 0, len(list.Items))
		for i := range list.Items {
			out = append(out, list.Items[i].Name)
		}
		return out
	}

	for version := range servedSnapshotVersions {
		wire, ok := wiring[version]
		require.Truef(t, ok, "served Snapshot version %q is not wired into the registration guard; add its registration and access wrapper", version)

		t.Run(version, func(t *testing.T) {
			deleteKey := "secret"
			dashboard := map[string]any{"title": "dashboard"}
			mine := dashv0.Snapshot{ObjectMeta: metav1.ObjectMeta{Name: "mine"}, Spec: dashv0.SnapshotSpec{DeleteKey: &deleteKey, Dashboard: dashboard}}
			mine.SetCreatedBy("user:alice")
			theirs := dashv0.Snapshot{ObjectMeta: metav1.ObjectMeta{Name: "theirs"}, Spec: dashv0.SnapshotSpec{DeleteKey: &deleteKey, Dashboard: dashboard}}
			theirs.SetCreatedBy("user:bob")

			mockStore := grafanarest.NewMockStorage(t)
			mockStore.On("List", mock.Anything, mock.Anything).Return(&dashv0.SnapshotList{Items: []dashv0.Snapshot{*mine.DeepCopy(), *theirs.DeepCopy()}}, nil)

			scheme := runtime.NewScheme()
			require.NoError(t, dashv0.AddToScheme(scheme))
			codecs := serializer.NewCodecFactory(scheme)
			optsGetter, err := restoptions.NewRESTOptionsGetterMemory(storagebackend.Config{
				Codec: codecs.LegacyCodec(wire.snapshots.GroupVersion()),
			}, nil)
			require.NoError(t, err)

			builder := &DashboardsAPIBuilder{
				iamFeatures:     iamapi.Features{ResourcePermissionsAPI: true},
				accessControl:   acmock.New(),
				namespacer:      apiserverrequest.GetNamespaceMapper(nil),
				snapshotService: dashboardsnapshots.NewMockService(t),
			}
			groupInfo := &genericapiserver.APIGroupInfo{VersionedResourcesStorageMap: map[string]map[string]rest.Storage{}}
			err = builder.storageForVersion(groupInfo, apiserverbuilder.APIGroupOptions{
				Scheme:     scheme,
				OptsGetter: optsGetter,
				DualWriteBuilder: func(_ schema.GroupResource, _, _ grafanarest.Storage) (grafanarest.Storage, error) {
					return mockStore, nil
				},
			}, wire.dashboards, nil, wire.snapshots, func(runtime.Object, *dashinternal.DashboardAccess) (runtime.Object, error) {
				return &dashv0.DashboardWithAccessInfo{}, nil
			})
			require.NoError(t, err)

			versionStorage := groupInfo.VersionedResourcesStorageMap[version]
			snapStorage, ok := versionStorage[wire.snapshots.StoragePath()]
			require.Truef(t, ok, "version %q did not register snapshot storage", version)

			getter, ok := snapStorage.(rest.Getter)
			require.True(t, ok, "registered snapshot storage must support Get")
			lister, ok := snapStorage.(rest.Lister)
			require.True(t, ok, "registered snapshot storage must support List")

			ctx := k8srequest.WithNamespace(context.Background(), authlib.OrgNamespaceFormatter(1))

			// GET omits deleteKey and dashboard payload.
			getObj, err := getter.Get(identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserID: 1, UserUID: "alice"}), "mine", &metav1.GetOptions{})
			require.NoError(t, err)
			gotSnap, ok := getObj.(*dashv0.Snapshot)
			require.True(t, ok)
			require.Nil(t, gotSnap.Spec.DeleteKey)
			require.Nil(t, gotSnap.Spec.Dashboard)

			// Non-admin LIST excludes other creators' snapshots and omits sensitive fields.
			nonAdminObj, err := lister.List(identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserID: 1, UserUID: "alice", OrgRole: org.RoleEditor}), &internalversion.ListOptions{})
			require.NoError(t, err)
			nonAdminList, ok := nonAdminObj.(*dashv0.SnapshotList)
			require.True(t, ok)
			require.Equal(t, []string{"mine"}, names(nonAdminList))
			for i := range nonAdminList.Items {
				require.Nil(t, nonAdminList.Items[i].Spec.DeleteKey)
				require.Nil(t, nonAdminList.Items[i].Spec.Dashboard)
			}

			// Admin LIST includes other creators' snapshots (still stripped).
			adminObj, err := lister.List(identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserID: 2, OrgRole: org.RoleAdmin}), &internalversion.ListOptions{})
			require.NoError(t, err)
			adminList, ok := adminObj.(*dashv0.SnapshotList)
			require.True(t, ok)
			require.ElementsMatch(t, []string{"mine", "theirs"}, names(adminList))
			for i := range adminList.Items {
				require.Nil(t, adminList.Items[i].Spec.DeleteKey)
				require.Nil(t, adminList.Items[i].Spec.Dashboard)
			}
		})
	}
}

func TestOtherDashboardGroupResourcesDeclareGVK(t *testing.T) {
	group := dashv0.DashboardResourceInfo.GroupResource().Group

	for _, tc := range []struct {
		name   string
		info   utils.ResourceInfo
		opts   apistore.StorageOptions
		folder bool
	}{
		{"variables", dashv2beta1.VariableResourceInfo, variableStorageOpts(), true},
		{"notebooks", dashv2beta1.NotebookResourceInfo, notebookStorageOpts(), false},
		{"snapshots", dashv0.SnapshotResourceInfo, snapshotStorageOpts(), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := &gvkRecorder{}
			opts := apiserverbuilder.APIGroupOptions{
				Scheme:     runtime.NewScheme(),
				OptsGetter: recorder,
			}

			opts.StorageOptsGetterFor(tc.info, tc.opts)

			require.Len(t, recorder.recorded, 1)
			so := recorder.recorded[0]
			require.Equal(t, tc.info.GroupVersionKind(), so.GVK)
			require.Equal(t, group, so.GVK.Group)
			require.NotEmpty(t, so.GVK.Version, "an empty version persists without an apiVersion")
			require.NotEmpty(t, so.GVK.Kind)
			// Folder support is the one thing these three actually disagree on, and
			// for notebooks it is load-bearing: their RBAC grant is a flat notebooks:*
			// wildcard, so a folder-scoped notebook would bypass the folder's ACL.
			require.Equal(t, tc.folder, so.EnableFolderSupport)
			require.False(t, so.RequireFolder)
		})
	}
}
