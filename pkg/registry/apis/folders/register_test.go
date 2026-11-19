package folders

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	restful "github.com/emicklei/go-restful/v3"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/admission"
	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	clientrest "k8s.io/client-go/rest"
	basecompatibility "k8s.io/component-base/compatibility"

	"github.com/grafana/authlib/authn"
	authtypes "github.com/grafana/authlib/types"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	pending "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1alpha1"
	foldersv1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission/rpclient"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	apiserverbuilder "github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/keysroutes"
	"github.com/grafana/grafana/pkg/services/apiserver/restoptions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/cascadedelete"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestPendingClientConditionalCleanupThroughAPI(t *testing.T) {
	b := NewAPIService(nil, nil, featuremgmt.WithFeatures(), nil, nil, nil, nil, 4, nil, WithPendingDeletionResourceEnabled(true))
	scheme := runtime.NewScheme()
	metav1.AddToGroupVersion(scheme, schema.GroupVersion{Version: "v1"})
	require.NoError(t, b.InstallSchema(scheme))
	codecs := serializer.NewCodecFactory(scheme)
	opts, err := restoptions.NewRESTOptionsGetterMemory(storagebackend.Config{Codec: codecs.LegacyCodec(pending.SchemeGroupVersion)}, nil)
	require.NoError(t, err)
	info := genericapiserver.NewDefaultAPIGroupInfo(folders.GROUP, scheme, metav1.ParameterCodec, codecs)
	require.NoError(t, b.UpdateAPIGroupInfo(&info, apiserverbuilder.APIGroupOptions{Scheme: scheme, OptsGetter: opts}))
	info.VersionedResourcesStorageMap = map[string]map[string]rest.Storage{"v1alpha1": {"pendingfolderdeletions": info.VersionedResourcesStorageMap["v1alpha1"]["pendingfolderdeletions"]}}
	config := genericapiserver.NewConfig(codecs)
	config.ExternalAddress = "127.0.0.1:443"
	config.LoopbackClientConfig = &clientrest.Config{}
	config.EffectiveVersion = basecompatibility.NewEffectiveVersionFromString("", "", "")
	config.SkipOpenAPIInstallation = true
	config.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(apiserverbuilder.GetOpenAPIDefinitions([]apiserverbuilder.APIGroupBuilder{b}), openapinamer.NewDefinitionNamer(scheme))
	config.Authorization.Authorizer = b.GetAuthorizer()
	server, err := config.Complete(nil).New("pending-test", genericapiserver.NewEmptyDelegate())
	require.NoError(t, err)
	t.Cleanup(server.Destroy)
	require.NoError(t, server.InstallAPIGroup(&info))
	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := identity.WithServiceIdentityContext(r.Context(), 1)
		ctx = request.WithUser(ctx, &k8suser.DefaultInfo{Name: "internal-test-service"})
		server.Handler.FullHandlerChain.ServeHTTP(w, r.WithContext(ctx))
	}))
	defer httpServer.Close()
	dyn, err := dynamic.NewForConfig(&clientrest.Config{Host: httpServer.URL})
	require.NoError(t, err)
	client := cascadedelete.NewPendingClient(dyn)
	entry := &pending.PendingFolderDeletion{ObjectMeta: metav1.ObjectMeta{Name: "reports-old-uid", Namespace: "default"}, Spec: pending.PendingFolderDeletionSpec{FolderName: "reports", FolderUID: "old-uid"}}
	u, err := runtime.DefaultUnstructuredConverter.ToUnstructured(entry)
	require.NoError(t, err)
	u["apiVersion"] = "folder.grafana.app/v1alpha1"
	u["kind"] = "PendingFolderDeletion"
	resource := dyn.Resource(pending.PendingFolderDeletionResourceInfo.GroupVersionResource()).Namespace("default")
	_, err = resource.Create(t.Context(), &unstructured.Unstructured{Object: u}, metav1.CreateOptions{})
	require.NoError(t, err)
	stale, err := client.Get(t.Context(), "default", entry.Name)
	require.NoError(t, err)
	require.NoError(t, client.Capture(t.Context(), stale, metav1.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)))
	require.True(t, apierrors.IsConflict(client.Remove(t.Context(), stale)), "stale API cleanup must preserve the captured entry")
	fresh, err := client.Get(t.Context(), "default", entry.Name)
	require.NoError(t, err)
	require.NotNil(t, fresh.Spec.DeletionTimestamp)
	require.Equal(t, "2026-11-11T12:00:00Z", *fresh.Spec.DeletionTimestamp)
	require.NoError(t, client.Remove(t.Context(), fresh))
	_, err = client.Get(t.Context(), "default", entry.Name)
	require.True(t, apierrors.IsNotFound(err))

	_, err = resource.Create(t.Context(), &unstructured.Unstructured{Object: u}, metav1.CreateOptions{})
	require.NoError(t, err)
	recreated, err := client.Get(t.Context(), "default", entry.Name)
	require.NoError(t, err)
	require.NotEqual(t, fresh.UID, recreated.UID)
	// Use the current version to isolate the stale UID precondition.
	fresh.ResourceVersion = recreated.ResourceVersion
	require.True(t, apierrors.IsConflict(client.Remove(t.Context(), fresh)))
	preserved, err := client.Get(t.Context(), "default", entry.Name)
	require.NoError(t, err)
	require.Equal(t, recreated, preserved)
	require.NoError(t, client.Remove(t.Context(), recreated))
}

func TestFolderAPIBuilder_PendingDeletionSchema(t *testing.T) {
	scheme := runtime.NewScheme()
	require.NoError(t, (&FolderAPIBuilder{}).InstallSchema(scheme))
	require.False(t, scheme.Recognizes(schema.GroupVersionKind{Group: "folder.grafana.app", Version: "v1alpha1", Kind: "Folder"}))
	for _, version := range []string{"v1", "v1beta1"} {
		require.True(t, scheme.Recognizes(schema.GroupVersionKind{Group: "folder.grafana.app", Version: version, Kind: "Folder"}))
	}
	require.Equal(t, "v1", scheme.PrioritizedVersionsForGroup("folder.grafana.app")[0].Version)
	for _, kind := range []string{"PendingFolderDeletion", "PendingFolderDeletionList"} {
		_, err := scheme.New(schema.GroupVersionKind{Group: "folder.grafana.app", Version: "v1alpha1", Kind: kind})
		require.NoError(t, err)
		require.False(t, scheme.Recognizes(schema.GroupVersionKind{Group: "folder.grafana.app", Version: "v1", Kind: kind}))
	}
}

func TestFolderAPIBuilder_PendingDeletionStorage(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		t.Run(fmt.Sprint(enabled), func(t *testing.T) {
			b := NewAPIService(nil, nil, featuremgmt.WithFeatures(), nil, nil, nil, nil, 4, nil, WithPendingDeletionResourceEnabled(enabled))
			scheme := runtime.NewScheme()
			require.NoError(t, b.InstallSchema(scheme))
			codecs := serializer.NewCodecFactory(scheme)
			optsGetter, err := restoptions.NewRESTOptionsGetterMemory(storagebackend.Config{Codec: codecs.LegacyCodec(b.GetGroupVersions()...)}, nil)
			require.NoError(t, err)
			info := genericapiserver.NewDefaultAPIGroupInfo(folders.GROUP, scheme, metav1.ParameterCodec, codecs)
			require.NoError(t, b.UpdateAPIGroupInfo(&info, apiserverbuilder.APIGroupOptions{Scheme: scheme, OptsGetter: optsGetter}))
			if enabled {
				require.Len(t, info.VersionedResourcesStorageMap, 3)
				require.Len(t, info.VersionedResourcesStorageMap["v1alpha1"], 1)
				require.Same(t, b.pendingDeletionStore, info.VersionedResourcesStorageMap["v1alpha1"]["pendingfolderdeletions"])
				require.NotNil(t, b.pendingDeletionStore)
			} else {
				require.Len(t, info.VersionedResourcesStorageMap, 2)
				require.Nil(t, b.pendingDeletionStore)
			}
			for _, version := range []string{"v1", "v1beta1"} {
				require.Contains(t, info.VersionedResourcesStorageMap[version], "folders")
				require.NotContains(t, info.VersionedResourcesStorageMap[version], "pendingfolderdeletions")
			}
			t.Run("served versions", func(t *testing.T) {
				want := []schema.GroupVersion{folders.SchemeGroupVersion, foldersv1beta1.SchemeGroupVersion}
				if enabled {
					want = append(want, pending.SchemeGroupVersion)
				}
				require.Equal(t, want, b.GetGroupVersions())
				served := apiserverbuilder.ServedGroupVersions([]apiserverbuilder.APIGroupBuilder{b}, nil)
				require.Len(t, served, len(want))
				for _, gv := range want {
					require.True(t, served[gv])
				}
			})
			t.Run("mounted keys routes", func(t *testing.T) {
				store := resource.NewMockResourceClient(t)
				var listed []*resourcepb.ListRequest
				store.On("List", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
					listed = append(listed, args.Get(1).(*resourcepb.ListRequest))
				}).Return(&resourcepb.ListResponse{ResourceVersion: 1}, nil)
				routes := keysroutes.Build(true, tracing.NewNoopTracerService(), store, []apiserverbuilder.APIGroupBuilder{b}, nil)
				container := restful.NewContainer()
				container.Router(restful.CurlyRouter{})
				config := serverstorage.NewResourceConfig()
				config.EnableVersions(folders.SchemeGroupVersion, foldersv1beta1.SchemeGroupVersion, pending.SchemeGroupVersion)
				require.NoError(t, apiserverbuilder.AugmentWebServicesWithCustomRoutes(container, nil, nil, config, routes...))
				for _, target := range []struct {
					version, resource string
					available         bool
				}{
					{"v1", "folders", true},
					{"v1beta1", "folders", true},
					{"v1alpha1", "pendingfolderdeletions", enabled},
				} {
					for _, namespace := range []string{"", "default"} {
						path := "/apis/folder.grafana.app/" + target.version + "/"
						if namespace != "" {
							path += "namespaces/" + namespace + "/"
						}
						path += target.resource + "/list-keys"
						req := httptest.NewRequest(http.MethodPost, path, nil)
						req = req.WithContext(identity.WithServiceIdentityContext(req.Context(), 1))
						rec := httptest.NewRecorder()
						before := len(listed)
						container.ServeHTTP(rec, req)
						if !target.available {
							require.Equal(t, http.StatusNotFound, rec.Code, path)
							require.Len(t, listed, before, "unavailable routes must not reach unified storage")
							continue
						}
						require.Equal(t, http.StatusOK, rec.Code, "%s: %s", path, rec.Body.String())
						require.Len(t, listed, before+1)
						require.True(t, listed[before].KeysOnly)
						key := listed[before].Options.Key
						require.Equal(t, folders.GROUP, key.Group)
						require.Equal(t, target.resource, key.Resource)
						require.Equal(t, namespace, key.Namespace)
					}
				}
			})
		})
	}
}

func TestPendingDeleteUIDNamesThroughStorage(t *testing.T) {
	for _, tc := range []struct {
		name  string
		uid   string
		valid bool
	}{
		{"mixed case non-UUID", "CalculatedUID-AbC123", true},
		{"slash", "unsupported/UID", false},
		{"dot in composite name", ".", true},
		{"percent", "unsupported%UID", false},
		{"253 characters", strings.Repeat("x", 234), true},
		{"unsupported Unicode", "é", false},
		{"254 characters", strings.Repeat("x", 235), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			uid := tc.uid
			b := NewAPIService(nil, nil, featuremgmt.WithFeatures(), nil, nil, nil, nil, 4, nil, WithPendingDeletionResourceEnabled(true))
			scheme := runtime.NewScheme()
			require.NoError(t, b.InstallSchema(scheme))
			codecs := serializer.NewCodecFactory(scheme)
			opts, err := restoptions.NewRESTOptionsGetterMemory(storagebackend.Config{Codec: codecs.LegacyCodec(b.GetGroupVersions()...)}, nil)
			require.NoError(t, err)
			info := genericapiserver.NewDefaultAPIGroupInfo(folders.GROUP, scheme, metav1.ParameterCodec, codecs)
			require.NoError(t, b.UpdateAPIGroupInfo(&info, apiserverbuilder.APIGroupOptions{Scheme: scheme, OptsGetter: opts}))
			f := newFolder("legacy-folder-name")
			f.UID = types.UID(uid)
			store := &fakeFolderStorage{existing: map[string]*folders.Folder{f.Name: f}}
			wrapped := newPendingDeleteStorage(store, b.pendingDeletionStore, func(context.Context) bool { return true }, &recordingAccessClient{})
			ctx := ctxWithNamespace()
			_, _, err = wrapped.Delete(ctx, f.Name, nil, &metav1.DeleteOptions{})
			if !tc.valid {
				require.Error(t, err)
				require.Empty(t, store.deleted)
				return
			}
			require.NoError(t, err)
			require.Equal(t, []string{f.Name}, store.deleted)
			obj, err := b.pendingDeletionStore.Get(ctx, "legacy-folder-name-"+uid, &metav1.GetOptions{})
			require.NoError(t, err)
			entry := obj.(*pending.PendingFolderDeletion)
			require.Equal(t, "legacy-folder-name-"+uid, entry.Name)
			require.Equal(t, uid, entry.Spec.FolderUID)
			require.Equal(t, "legacy-folder-name", entry.Spec.FolderName)
		})
	}
}

func TestFolderAPIBuilder_PendingDeletionWriterMatrix(t *testing.T) {
	for _, resourceEnabled := range []bool{false, true} {
		for _, writerEnabled := range []bool{false, true} {
			for _, mode := range []string{"delete", "cascade", "collection", "dry-run", "cascade-dry-run", "collection-dry-run"} {
				t.Run(fmt.Sprintf("resource=%t/writer=%t/%s", resourceEnabled, writerEnabled, mode), func(t *testing.T) {
					cascade := mode == "cascade" || mode == "cascade-dry-run"
					dryRun := mode == "dry-run" || mode == "cascade-dry-run" || mode == "collection-dry-run"
					setOpenFeatureToggles(t, map[string]bool{
						featuremgmt.FlagFolderPendingDeletionWrites:   writerEnabled,
						featuremgmt.FlagKubernetesFolderCascadeDelete: cascade,
					})
					access := &recordingAccessClient{}
					contents := &recordingContentsDeleter{}
					b := NewAPIService(access, nil, featuremgmt.WithFeatures(), nil, nil, nil, nil, 4, contents, WithPendingDeletionResourceEnabled(resourceEnabled))
					b.searcher = &fakeCascadeSearcher{}
					scheme := runtime.NewScheme()
					require.NoError(t, b.InstallSchema(scheme))
					codecs := serializer.NewCodecFactory(scheme)
					opts, err := restoptions.NewRESTOptionsGetterMemory(storagebackend.Config{Codec: codecs.LegacyCodec(b.GetGroupVersions()...)}, nil)
					require.NoError(t, err)
					info := genericapiserver.NewDefaultAPIGroupInfo(folders.GROUP, scheme, metav1.ParameterCodec, codecs)
					require.NoError(t, b.UpdateAPIGroupInfo(&info, apiserverbuilder.APIGroupOptions{Scheme: scheme, OptsGetter: opts}))
					ctx := identity.WithRequester(request.WithNamespace(t.Context(), "default"), &identity.StaticRequester{UserUID: "user", OrgID: 1})
					store := info.VersionedResourcesStorageMap["v1"]["folders"].(grafanarest.Storage)
					obj, err := store.Create(ctx, &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "reports", Namespace: "default"}, Spec: folders.FolderSpec{Title: "Reports"}}, nil, &metav1.CreateOptions{})
					require.NoError(t, err)
					created := obj.(*folders.Folder)
					options := &metav1.DeleteOptions{}
					if cascade {
						options = forceDelete()
						options.Preconditions = &metav1.Preconditions{UID: &created.UID, ResourceVersion: &created.ResourceVersion}
					}
					if dryRun {
						options.DryRun = []string{metav1.DryRunAll}
					}
					if mode == "collection" || mode == "collection-dry-run" {
						_, err = store.(rest.CollectionDeleter).DeleteCollection(ctx, rest.ValidateAllObjectFunc, options, nil)
					} else {
						_, _, err = store.Delete(ctx, created.Name, rest.ValidateAllObjectFunc, options)
					}
					blocked := writerEnabled && !resourceEnabled && !dryRun
					if blocked {
						require.True(t, apierrors.IsServiceUnavailable(err), "expected unavailable, got %v", err)
					} else {
						require.NoError(t, err)
					}
					remaining, getErr := store.Get(ctx, created.Name, &metav1.GetOptions{})
					if blocked || dryRun {
						require.NoError(t, getErr)
						require.Equal(t, created, remaining, "failed/dry-run delete must not even mark the folder")
					} else {
						require.True(t, apierrors.IsNotFound(getErr), "%v", getErr)
					}
					if cascade && !blocked && !dryRun {
						require.Equal(t, []string{"reports"}, contents.folders)
					} else {
						require.Empty(t, contents.folders)
					}
					if resourceEnabled {
						entry, err := b.pendingDeletionStore.Get(ctx, created.Name+"-"+string(created.UID), &metav1.GetOptions{})
						if writerEnabled && !dryRun {
							require.NoError(t, err)
							require.Equal(t, created.Name+"-"+string(created.UID), entry.(*pending.PendingFolderDeletion).Name)
							require.Equal(t, created.Name, entry.(*pending.PendingFolderDeletion).Spec.FolderName)
						} else {
							require.True(t, apierrors.IsNotFound(err), "%v", err)
						}
					}
				})
			}
		}
	}
}

func TestFolderAPIBuilder_PendingDeletionAuthorization(t *testing.T) {
	service := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Rest: authn.AccessTokenClaims{Permissions: []string{"folder.grafana.app/pendingfolderdeletions:create"}},
	})
	delegated := authn.NewIDTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Rest: authn.AccessTokenClaims{DelegatedPermissions: []string{"folder.grafana.app/pendingfolderdeletions:create"}},
	}, &authn.Claims[authn.IDTokenClaims]{Rest: authn.IDTokenClaims{Type: authtypes.TypeUser}})
	for _, tc := range []struct {
		name string
		ctx  context.Context
		verb string
		want authorizer.Decision
	}{
		{"no identity", context.Background(), "create", authorizer.DecisionDeny},
		{"user", identity.WithRequester(context.Background(), &identity.StaticRequester{Type: authtypes.TypeUser}), "create", authorizer.DecisionDeny},
		{"user-created service account", identity.WithRequester(context.Background(), &identity.StaticRequester{Type: authtypes.TypeServiceAccount}), "create", authorizer.DecisionDeny},
		{"embedded service", identity.WithServiceIdentityContext(context.Background(), 1), "create", authorizer.DecisionAllow},
		{"direct service", authtypes.WithAuthInfo(context.Background(), service), "create", authorizer.DecisionAllow},
		{"wrong verb permission", authtypes.WithAuthInfo(context.Background(), service), "delete", authorizer.DecisionDeny},
		{"delegated user", authtypes.WithAuthInfo(context.Background(), delegated), "create", authorizer.DecisionDeny},
	} {
		t.Run(tc.name, func(t *testing.T) {
			decision, _, _ := (&FolderAPIBuilder{}).GetAuthorizer().Authorize(tc.ctx, authorizer.AttributesRecord{
				ResourceRequest: true, APIGroup: "folder.grafana.app", APIVersion: "v1alpha1", Resource: "pendingfolderdeletions", Verb: tc.verb,
			})
			require.Equal(t, tc.want, decision)
		})
	}
}

func TestFolderAPIBuilder_PendingDeletionAdmission(t *testing.T) {
	builder := &FolderAPIBuilder{}
	valid := &pending.PendingFolderDeletion{ObjectMeta: metav1.ObjectMeta{Name: "reports-uid-a", Namespace: "default", UID: "pending-record-uid"},
		Spec: pending.PendingFolderDeletionSpec{FolderName: "reports", FolderUID: "uid-a"}}
	timestamp := "2026-11-11T12:00:00Z"
	captured := valid.DeepCopy()
	captured.Spec.DeletionTimestamp = &timestamp
	wrongName := valid.DeepCopy()
	wrongName.Name = "wrong"
	for _, tc := range []struct {
		name      string
		mutate    func(*pending.PendingFolderDeletion)
		old       *pending.PendingFolderDeletion
		wantField string
	}{
		{"valid", func(*pending.PendingFolderDeletion) {}, nil, ""},
		{"mismatched create name", func(p *pending.PendingFolderDeletion) { p.Name = "wrong" }, nil, "metadata.name"},
		{"mismatched existing update name", func(p *pending.PendingFolderDeletion) { p.Name = "wrong" }, wrongName, "metadata.name"},
		{"missing UID", func(p *pending.PendingFolderDeletion) { p.Spec.FolderUID = "" }, nil, "spec.folderUID"},
		{"missing name", func(p *pending.PendingFolderDeletion) { p.Spec.FolderName = "" }, nil, "spec.folderName"},
		{"invalid timestamp", func(p *pending.PendingFolderDeletion) { v := "bad"; p.Spec.DeletionTimestamp = &v }, nil, "spec.deletionTimestamp"},
		{"changed UID", func(p *pending.PendingFolderDeletion) { p.Spec.FolderUID = "uid-b" }, valid, "spec.folderUID"},
		{"changed name", func(p *pending.PendingFolderDeletion) { p.Spec.FolderName = "other" }, valid, "spec.folderName"},
		{"unchanged identity", func(*pending.PendingFolderDeletion) {}, valid, ""},
		{"capture timestamp once", func(p *pending.PendingFolderDeletion) { p.Spec.DeletionTimestamp = &timestamp }, valid, ""},
		{"preserve captured timestamp", func(p *pending.PendingFolderDeletion) { p.Spec.DeletionTimestamp = &timestamp }, captured, ""},
		{"clear captured timestamp", func(*pending.PendingFolderDeletion) {}, captured, "spec.deletionTimestamp"},
		{"change captured timestamp", func(p *pending.PendingFolderDeletion) { v := "2026-11-11T13:00:00Z"; p.Spec.DeletionTimestamp = &v }, captured, "spec.deletionTimestamp"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			obj := valid.DeepCopy()
			tc.mutate(obj)
			op := admission.Create
			var old runtime.Object
			if tc.old != nil {
				op = admission.Update
				old = tc.old
			}
			attrs := admission.NewAttributesRecord(obj, old, pending.SchemeGroupVersion.WithKind("PendingFolderDeletion"), "default", obj.Name,
				pending.SchemeGroupVersion.WithResource("pendingfolderdeletions"), "", op, nil, false, nil)
			require.NoError(t, builder.Mutate(context.Background(), attrs, nil))
			err := builder.Validate(context.Background(), attrs, nil)
			if tc.wantField != "" {
				require.True(t, apierrors.IsInvalid(err), "expected validation status, got %v", err)
				var status *apierrors.StatusError
				require.ErrorAs(t, err, &status)
				require.EqualValues(t, 422, status.ErrStatus.Code)
				require.Equal(t, tc.wantField, status.ErrStatus.Details.Causes[0].Field)
				if obj.Spec.FolderName == "" || obj.Spec.FolderUID == "" {
					require.Len(t, status.ErrStatus.Details.Causes, 1, "missing identity must not add a misleading name error")
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestFolderDefaultResourcePermissionsUseRPClient(t *testing.T) {
	gvr := iamv0.ResourcePermissionInfo.GroupVersionResource()
	gr := folders.FolderResourceInfo.GroupVersionResource().GroupResource()
	newClient := func() *dynamicfake.FakeDynamicClient {
		return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{gvr: "ResourcePermissionList"})
	}
	newFolder := func(uid, parent string) (*folders.Folder, utils.GrafanaMetaAccessor) {
		obj := &folders.Folder{ObjectMeta: metav1.ObjectMeta{
			Name: uid, Namespace: "org-7", Annotations: map[string]string{"grafana.app/folder": parent},
		}}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		return obj, meta
	}

	t.Run("writes root defaults and creator grant", func(t *testing.T) {
		dyn := newClient()
		resourceClient := dyn.Resource(gvr)
		b := &FolderAPIBuilder{resourcePermissions: rpclient.New(rpclient.Static(resourceClient), gr)}
		_, meta := newFolder("root-uid", "")
		id := &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "user-123"}
		require.NoError(t, b.setDefaultFolderPermissions(context.Background(), nil, id, meta))
		rp, err := resourceClient.Namespace("org-7").Get(context.Background(), rpclient.Name(gr, "root-uid"), metav1.GetOptions{})
		require.NoError(t, err)
		permissions, found, err := unstructured.NestedSlice(rp.Object, "spec", "permissions")
		require.NoError(t, err)
		require.True(t, found)
		require.Equal(t, []any{
			map[string]any{"kind": "User", "name": "user-123", "verb": "admin"},
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
		}, permissions)
	})

	t.Run("nested folders and absent client do not write", func(t *testing.T) {
		dyn := newClient()
		resourceClient := dyn.Resource(gvr)
		b := &FolderAPIBuilder{resourcePermissions: rpclient.New(rpclient.Static(resourceClient), gr)}
		_, meta := newFolder("nested-uid", "parent-uid")
		require.NoError(t, b.setDefaultFolderPermissions(context.Background(), nil, &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "user-123"}, meta))
		require.Empty(t, dyn.Actions())
		_, rootMeta := newFolder("root-uid", "")
		require.NoError(t, (&FolderAPIBuilder{}).setDefaultFolderPermissions(context.Background(), nil, &identity.StaticRequester{}, rootMeta))
		require.Empty(t, dyn.Actions())
	})

	t.Run("after delete removes the matching permission", func(t *testing.T) {
		rpName := rpclient.Name(gr, "root-uid")
		dyn := newClient()
		_, err := dyn.Resource(gvr).Namespace("org-7").Create(context.Background(), &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": iamv0.ResourcePermissionInfo.GroupVersion().String(), "kind": "ResourcePermission",
			"metadata": map[string]any{"name": rpName, "namespace": "org-7"},
		}}, metav1.CreateOptions{})
		require.NoError(t, err)
		resourceClient := dyn.Resource(gvr)
		b := &FolderAPIBuilder{resourcePermissions: rpclient.New(rpclient.Static(resourceClient), gr)}
		obj, _ := newFolder("root-uid", "")
		b.afterDelete(obj, &metav1.DeleteOptions{})
		_, err = resourceClient.Namespace("org-7").Get(context.Background(), rpName, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err))
	})
}

func TestFolderAPIBuilder_Validate_Create(t *testing.T) {
	type input struct {
		obj         *folders.Folder
		annotations map[string]string
		name        string
	}

	tests := []struct {
		name    string
		input   input
		setupFn func(*grafanarest.MockStorage)
		err     error
	}{
		{
			name: "should return error when name is invalid",
			input: input{
				obj: &folders.Folder{
					Spec: folders.FolderSpec{
						Title: "foo",
					},
				},
				name: "general",
			},
			err: folder.ErrInvalidUID,
		},
		{
			name: "should return no error if every validation passes",
			input: input{
				obj: &folders.Folder{
					Spec: folders.FolderSpec{
						Title: "foo",
					},
				},
				name: "valid-name",
			},
		},
		{
			name: "should return error when title is empty",
			input: input{
				obj: &folders.Folder{
					Spec: folders.FolderSpec{
						Title: "",
					},
				},
				name: "foo",
			},
			err: folder.ErrTitleEmpty,
		},
		{
			name: "should return error if folder is a parent of itself",
			input: input{
				annotations: map[string]string{utils.AnnoKeyFolder: "myself"},
				obj: &folders.Folder{
					Spec: folders.FolderSpec{
						Title: "title",
					},
				},
				name: "myself",
			},
			err: folder.ErrFolderCannotBeParentOfItself,
		},
		{
			name: "should not allow creating a folder that will become too deep",
			input: input{
				annotations: map[string]string{utils.AnnoKeyFolder: "p1"},
				obj: &folders.Folder{
					Spec: folders.FolderSpec{
						Title: "title",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:        "p0",
						Annotations: map[string]string{"grafana.app/folder": "p1"},
					},
				},
				name: "p0",
			},
			setupFn: func(m *grafanarest.MockStorage) {
				m.On("Get", mock.Anything, "p1", mock.Anything).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name:        "p1",
							Annotations: map[string]string{"grafana.app/folder": "p2"},
						},
					}, nil)
				m.On("Get", mock.Anything, "p2", mock.Anything).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name:        "p2",
							Annotations: map[string]string{"grafana.app/folder": "p3"},
						},
					}, nil)
				m.On("Get", mock.Anything, "p3", mock.Anything).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name:        "p3",
							Annotations: map[string]string{"grafana.app/folder": "p4"},
						},
					}, nil)
				m.On("Get", mock.Anything, "p4", mock.Anything).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name:        "p4",
							Annotations: map[string]string{"grafana.app/folder": "p5"},
						},
					}, nil)
				m.On("Get", mock.Anything, "p5", mock.Anything).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name: "p5",
						},
					}, nil)
			},
			err: fmt.Errorf("folder max depth exceeded, max depth is 4"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			us := grafanarest.NewMockStorage(t)

			b := &FolderAPIBuilder{
				storage:              us,
				parents:              newParentsGetter(us),
				maxNestedFolderDepth: setting.NewCfg().MaxNestedFolderDepth,
			}

			tt.input.obj.Name = tt.input.name
			tt.input.obj.Annotations = tt.input.annotations

			if tt.setupFn != nil {
				tt.setupFn(us)
			}

			err := b.Validate(request.WithNamespace(context.Background(), "stacks-123"), admission.NewAttributesRecord(
				tt.input.obj,
				nil,
				folders.SchemeGroupVersion.WithKind("folder"),
				"stacks-123",
				tt.input.name,
				folders.SchemeGroupVersion.WithResource("folders"),
				"",
				"CREATE",
				nil,
				true,
				&user.SignedInUser{},
			), nil)

			if tt.err == nil {
				require.NoError(t, err)
			} else {
				require.Contains(t, err.Error(), tt.err.Error())
				return
			}
		})
	}
}

func TestFolderAPIBuilder_Validate_CreateMissingParent(t *testing.T) {
	for _, tc := range []struct {
		name               string
		parentName         string
		missingGrandparent bool
	}{
		{name: "immediate parent missing", parentName: "missing"},
		{name: "grandparent missing", parentName: "parent", missingGrandparent: true},
	} {
		for _, dryRun := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/dryRun=%t", tc.name, dryRun), func(t *testing.T) {
				storage := grafanarest.NewMockStorage(t)
				if tc.missingGrandparent {
					storage.On("Get", mock.Anything, "parent", &metav1.GetOptions{}).Return(&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name:        "parent",
							Annotations: map[string]string{utils.AnnoKeyFolder: "missing"},
						},
						Spec: folders.FolderSpec{Title: "parent"},
					}, nil).Once()
				}
				storage.On("Get", mock.Anything, "missing", &metav1.GetOptions{}).
					Return(nil, apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), "missing")).Once()
				b := &FolderAPIBuilder{
					storage:              storage,
					parents:              newParentsGetter(storage),
					maxNestedFolderDepth: 5,
				}
				obj := &folders.Folder{
					ObjectMeta: metav1.ObjectMeta{
						Name:        "child",
						Annotations: map[string]string{utils.AnnoKeyFolder: tc.parentName},
					},
					Spec: folders.FolderSpec{Title: "child"},
				}
				err := b.Validate(request.WithNamespace(context.Background(), "default"), admission.NewAttributesRecord(
					obj, nil, folders.SchemeGroupVersion.WithKind("Folder"), "default", obj.Name,
					folders.SchemeGroupVersion.WithResource("folders"), "", admission.Create,
					nil, dryRun, &user.SignedInUser{},
				), nil)
				if dryRun || tc.missingGrandparent {
					require.NoError(t, err)
				} else {
					require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got %v", err)
				}
			})
		}
	}
}

func TestFolderAPIBuilder_Validate_Delete(t *testing.T) {
	zeroGrace := int64(0)

	tests := []struct {
		name                 string
		statsResponse        []*resourcepb.ResourceStatsResponse_Stats
		deleteOptions        *metav1.DeleteOptions
		cascadeDeleteEnabled bool
		wantErr              bool
	}{
		{
			name: "should allow deletion when folder is empty",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Count: 0, Resource: "dashboards"},
			},
		},
		{
			name: "should return folder not empty when folder contains dashboards",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Count: 2, Resource: "dashboards", Group: "dashboard.grafana.app"},
			},
			wantErr: true,
		},
		{
			name: "should return folder not empty when folder contains variables",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Count: 4, Resource: "variables", Group: "dashboard.grafana.app"},
			},
			wantErr: true,
		},
		{
			name: "should return folder not empty when folder contains alertrules",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Count: 3, Resource: "alertrules", Group: "alerting.grafana.app"},
			},
			wantErr: true,
		},
		{
			name: "should return folder not empty when folder contains library_elements",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Count: 1, Resource: "library_elements", Group: "library.grafana.app"},
			},
			wantErr: true,
		},
		{
			name: "should return folder not empty when folder contains folders",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Count: 2, Resource: "folders", Group: "folder.grafana.app"},
			},
			wantErr: true,
		},
		{
			name: "should return folder not empty when folder has mixed resources with validated types",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Count: 10, Resource: "folders", Group: "folder.grafana.app"},
				{Count: 2, Resource: "dashboards", Group: "dashboard.grafana.app"},
				{Count: 5, Resource: "playlists", Group: "playlist.grafana.app"},
			},
			wantErr: true,
		},
		{
			name: "should return folder not empty when folder has multiple validated resource types",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Count: 1, Resource: "dashboards", Group: "dashboard.grafana.app"},
				{Count: 2, Resource: "alertrules", Group: "alerting.grafana.app"},
				{Count: 1, Resource: "library_elements", Group: "library.grafana.app"},
				{Count: 1, Resource: "folders", Group: "folder.grafana.app"},
			},
			wantErr: true,
		},
		{
			name: "should allow deletion when all validated resource types are empty",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Count: 0, Resource: "dashboards", Group: "dashboard.grafana.app"},
				{Count: 0, Resource: "alertrules", Group: "alerting.grafana.app"},
				{Count: 0, Resource: "library_elements", Group: "library.grafana.app"},
				{Count: 0, Resource: "folders", Group: "folder.grafana.app"},
				{Count: 10, Resource: "playlists", Group: "playlist.grafana.app"},
			},
			wantErr: false,
		},
		{
			name: "should allow deletion when folder only contains non-validated resource types",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Count: 5, Resource: "playlists", Group: "playlist.grafana.app"},
				{Count: 3, Resource: "other", Group: "other.grafana.app"},
			},
			wantErr: false,
		},
		{
			name:          "should allow deletion when stats array is empty",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{},
			wantErr:       false,
		},
		{
			name: "should reject force delete when cascade gate disabled",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Resource: "folders", Count: 1, Group: "folder.grafana.app"},
			},
			deleteOptions:        &metav1.DeleteOptions{GracePeriodSeconds: &zeroGrace},
			cascadeDeleteEnabled: false,
			wantErr:              true,
		},
		{
			name: "should allow force delete when cascade gate enabled",
			statsResponse: []*resourcepb.ResourceStatsResponse_Stats{
				{Resource: "folders", Count: 1, Group: "folder.grafana.app"},
			},
			deleteOptions:        &metav1.DeleteOptions{GracePeriodSeconds: &zeroGrace},
			cascadeDeleteEnabled: true,
		},
	}

	obj := &folders.Folder{
		Spec: folders.FolderSpec{
			Title: "foo",
		},
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "stacks-123",
			Name:      "valid-name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			us := grafanarest.NewMockStorage(t)
			sm := resource.NewMockResourceClient(t)
			if !tt.cascadeDeleteEnabled || !forceDeleteFromDeleteOptions(tt.deleteOptions) {
				sm.On("GetStats", mock.Anything, &resourcepb.ResourceStatsRequest{Namespace: obj.Namespace, Kinds: countedKinds, Folder: []string{obj.Name}}).Return(
					&resourcepb.ResourceStatsResponse{Stats: tt.statsResponse},
					nil,
				).Once()
			}

			setKubernetesFolderCascadeDeleteToggle(t, tt.cascadeDeleteEnabled)

			b := &FolderAPIBuilder{
				storage:  us,
				searcher: sm,
			}

			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				nil,
				obj,
				folders.SchemeGroupVersion.WithKind("folder"),
				obj.Namespace,
				obj.Name,
				folders.SchemeGroupVersion.WithResource("folders"),
				"",
				admission.Delete,
				tt.deleteOptions,
				true,
				&user.SignedInUser{},
			),
				nil)

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestFolderAPIBuilder_Validate_Update(t *testing.T) {
	tests := []struct {
		name       string
		updatedObj *folders.Folder
		expected   *folders.Folder
		setupFn    func(*grafanarest.MockStorage)
		wantErr    bool
	}{
		{
			name: "should allow updating a folder spec",
			updatedObj: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "different title",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
				},
			},
			expected: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "different title",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
				},
			},
		},
		{
			name: "updated title should not be empty",
			updatedObj: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
				},
			},
			wantErr: true,
		},
		{
			name: "should allow moving to a valid parent",
			updatedObj: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "foo",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "new-parent"},
				},
			},
			setupFn: func(m *grafanarest.MockStorage) {
				m.On("Get", mock.Anything, "new-parent", mock.Anything).Return(
					&folders.Folder{},
					nil).Once()
				// the old parent is covered by the shared expectation above
			},
		},
		{
			name: "should not allow moving to a k6 folder",
			updatedObj: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "foo",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": accesscontrol.K6FolderUID},
				},
			},
			setupFn: func(m *grafanarest.MockStorage) {
				// nothing
			},
			wantErr: true,
		},
		{
			name: "should not allow moving to a folder that will become too deep",
			updatedObj: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "foo",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "p5"},
				},
			},
			setupFn: func(m *grafanarest.MockStorage) {
				m.On("Get", mock.Anything, "p5", mock.Anything).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name:        "p5",
							Annotations: map[string]string{"grafana.app/folder": "p4"},
						},
					}, nil)
				m.On("Get", mock.Anything, "p4", mock.Anything).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name:        "p4",
							Annotations: map[string]string{"grafana.app/folder": "p3"},
						},
					}, nil)
				m.On("Get", mock.Anything, "p3", mock.Anything).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name:        "p3",
							Annotations: map[string]string{"grafana.app/folder": "p2"},
						},
					}, nil)
				m.On("Get", mock.Anything, "p2", mock.Anything).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name:        "p2",
							Annotations: map[string]string{"grafana.app/folder": "p1"},
						},
					}, nil)
				m.On("Get", mock.Anything, "p1", mock.Anything).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name: "p1",
							// p1 is at root: the canonical annotation is "general",
							// and newParentsGetter must stop here without fetching
							// "general" as a real folder (it is not a resource).
							Annotations: map[string]string{"grafana.app/folder": folder.GeneralFolderUID},
						},
					}, nil)
			},
			wantErr: true,
		},
	}

	obj := &folders.Folder{
		Spec: folders.FolderSpec{
			Title: "foo",
		},
		ObjectMeta: metav1.ObjectMeta{
			Namespace:   "stacks-123",
			Name:        "valid-name",
			Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			us := grafanarest.NewMockStorage(t)
			sm := resource.NewMockResourceClient(t)
			// the source chain is resolved to reject moves out of the k6 tree
			us.On("Get", mock.Anything, "valid-parent", mock.Anything).Return(
				&folders.Folder{
					ObjectMeta: metav1.ObjectMeta{
						Name:        "valid-parent",
						Annotations: map[string]string{"grafana.app/folder": folder.GeneralFolderUID},
					},
				}, nil).Maybe()
			if tt.setupFn != nil {
				tt.setupFn(us)
			}

			b := &FolderAPIBuilder{
				storage:  us,
				searcher: sm,
				parents:  newParentsGetter(us),
			}

			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				tt.updatedObj,
				obj,
				folders.SchemeGroupVersion.WithKind("folder"),
				tt.updatedObj.Namespace,
				tt.updatedObj.Name,
				folders.SchemeGroupVersion.WithResource("folders"),
				"",
				"UPDATE",
				nil,
				true,
				&user.SignedInUser{},
			),
				nil)

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestFolderAPIBuilder_Mutate_Create(t *testing.T) {
	tests := []struct {
		name     string
		input    *folders.Folder
		expected *folders.Folder
		wantErr  bool
	}{
		{
			name: "should trim a title",
			input: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "  foo  ",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			expected: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "foo",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
		},
		{
			name: "should return error if title doesnt exist",
			input: &folders.Folder{
				Spec: folders.FolderSpec{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
		{
			name: "should return error if spec doesnt exist",
			input: &folders.Folder{
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagFolderAsyncCascadeDeleteThroughController: false})
			us := grafanarest.NewMockStorage(t)
			sm := resource.NewMockResourceClient(t)
			b := &FolderAPIBuilder{
				storage:  us,
				searcher: sm,
				parents:  newParentsGetter(us),
			}
			admAttr := admission.NewAttributesRecord(
				tt.input,
				nil,
				folders.SchemeGroupVersion.WithKind("folder"),
				"stacks-123",
				tt.input.Name,
				folders.SchemeGroupVersion.WithResource("folders"),
				"",
				"CREATE",
				nil,
				true,
				&user.SignedInUser{},
			)

			err := b.Validate(context.Background(), admAttr, nil)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			err = b.Mutate(context.Background(), admAttr, nil)
			require.NoError(t, err)
			require.Equal(t, tt.input, tt.expected)
		})
	}
}

func TestFolderAPIBuilder_Mutate_Update(t *testing.T) {
	existingObj := &folders.Folder{
		Spec: folders.FolderSpec{
			Title: "some title",
		},
		TypeMeta: metav1.TypeMeta{
			Kind: "Folder",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: "valid-name",
		},
	}
	tests := []struct {
		name     string
		input    *folders.Folder
		expected *folders.Folder
		wantErr  bool
	}{
		{
			name: "should trim a title",
			input: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "  foo  ",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			expected: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "foo",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
		},
		{
			name: "should return error if title doesnt exist",
			input: &folders.Folder{
				Spec: folders.FolderSpec{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
		{
			name: "should return error if spec doesnt exist",
			input: &folders.Folder{
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
	}
	us := grafanarest.NewMockStorage(t)
	sm := resource.NewMockResourceClient(t)
	b := &FolderAPIBuilder{
		storage:  us,
		searcher: sm,
		parents:  newParentsGetter(us),
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			admAttr := admission.NewAttributesRecord(
				tt.input,
				existingObj,
				folders.SchemeGroupVersion.WithKind("folder"),
				"stacks-123",
				tt.input.Name,
				folders.SchemeGroupVersion.WithResource("folders"),
				"",
				"UPDATE",
				nil,
				true,
				&user.SignedInUser{},
			)

			err := b.Validate(context.Background(), admAttr, nil)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			err = b.Mutate(context.Background(), admAttr, nil)
			require.NoError(t, err)
			require.Equal(t, tt.input, tt.expected)
		})
	}
}

func TestFolderAPIBuilder_Mutate_CascadeDeleteFinalizer(t *testing.T) {
	newBuilder := func(t *testing.T) *FolderAPIBuilder {
		us := grafanarest.NewMockStorage(t)
		return &FolderAPIBuilder{
			storage:  us,
			searcher: resource.NewMockResourceClient(t),
			parents:  newParentsGetter(us),
		}
	}
	attrs := func(obj, old *folders.Folder, op admission.Operation) admission.Attributes {
		// Keep the interface nil on create; a typed nil pointer would look like an old object.
		var oldObj runtime.Object
		if old != nil {
			oldObj = old
		}
		return admission.NewAttributesRecord(
			obj, oldObj,
			folders.SchemeGroupVersion.WithKind("folder"),
			"stacks-123", obj.Name,
			folders.SchemeGroupVersion.WithResource("folders"),
			"", op, nil, false, &user.SignedInUser{},
		)
	}

	t.Run("create with flag on stamps", func(t *testing.T) {
		setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagFolderAsyncCascadeDeleteThroughController: true})
		f := folderWithFinalizers()
		require.NoError(t, newBuilder(t).Mutate(context.Background(), attrs(f, nil, admission.Create), nil))
		require.Equal(t, []string{folders.CascadeDeleteFinalizer}, f.Finalizers)
	})
	t.Run("create with flag off strips", func(t *testing.T) {
		setOpenFeatureToggles(t, map[string]bool{featuremgmt.FlagFolderAsyncCascadeDeleteThroughController: false})
		f := folderWithFinalizers(folders.CascadeDeleteFinalizer)
		require.NoError(t, newBuilder(t).Mutate(context.Background(), attrs(f, nil, admission.Create), nil))
		require.Nil(t, f.Finalizers)
	})
	t.Run("update restores a dropped finalizer", func(t *testing.T) {
		f := folderWithFinalizers()
		old := folderWithFinalizers(folders.CascadeDeleteFinalizer)
		require.NoError(t, newBuilder(t).Mutate(context.Background(), attrs(f, old, admission.Update), nil))
		require.Equal(t, []string{folders.CascadeDeleteFinalizer}, f.Finalizers)
	})
}
