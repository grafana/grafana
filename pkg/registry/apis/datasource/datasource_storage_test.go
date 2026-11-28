package datasource

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"testing/synctest"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	registry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	clienttesting "k8s.io/client-go/testing"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission/rpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func newTestDatasourceResourcePermissions() (*rpclient.Client, *dynamicfake.FakeDynamicClient) {
	dyn := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
	resource := dyn.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource())
	return rpclient.New(rpclient.Static(resource), datasourceV0.DataSourceResourceInfo.GroupResource()), dyn
}

func TestProvideDatasourcePermissionsClient(t *testing.T) {
	if client := ProvideDatasourcePermissionsClient(ProvideNilDatasourceResourcePermissions()); client != nil {
		t.Fatalf("expected nil permissions client in OSS wiring, got %T", client)
	}
	permissions, _ := newTestDatasourceResourcePermissions()
	require.Same(t, permissions, ProvideDatasourcePermissionsClient(permissions))
}

func TestDatasourceCreatePermissions(t *testing.T) {
	for _, tt := range []struct {
		name          string
		mode          grafanarest.DualWriterMode
		actor         authlib.IdentityType
		creator       iamv0.ResourcePermissionSpecPermissionKind
		wantLegacy    bool
		wantUnified   bool
		wantDefaults  bool
		dryRun        bool
		permissionErr error
	}{
		{name: "legacy", mode: grafanarest.Mode0, wantLegacy: true, wantDefaults: true},
		{name: "mode 1", mode: grafanarest.Mode1, wantLegacy: true, wantUnified: true, wantDefaults: true},
		{name: "mode 2", mode: grafanarest.Mode2, wantLegacy: true, wantUnified: true, wantDefaults: true},
		{name: "mode 3", mode: grafanarest.Mode3, wantLegacy: true, wantUnified: true, wantDefaults: true},
		{name: "mode 4 user", mode: grafanarest.Mode4, actor: authlib.TypeUser, creator: iamv0.ResourcePermissionSpecPermissionKindUser, wantUnified: true, wantDefaults: true},
		{name: "mode 5 service account", mode: grafanarest.Mode5, actor: authlib.TypeServiceAccount, creator: iamv0.ResourcePermissionSpecPermissionKindServiceAccount, wantUnified: true, wantDefaults: true},
		{name: "provisioner", mode: grafanarest.Mode5, actor: authlib.TypeAccessPolicy, wantUnified: true, wantDefaults: true},
		{name: "dry run", mode: grafanarest.Mode5, actor: authlib.TypeUser, dryRun: true},
		{name: "IAM error after persistence", mode: grafanarest.Mode5, wantUnified: true, permissionErr: errors.New("IAM unavailable")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				const namespace = "stacks-2"
				ctx := request.WithNamespace(t.Context(), namespace)
				if tt.actor != "" {
					ctx = authlib.WithAuthInfo(ctx, &identity.StaticRequester{Type: tt.actor, UserID: 12, UserUID: "stable-actor-uid"})
				}
				permissions, dyn := newTestDatasourceResourcePermissions()
				if tt.permissionErr != nil {
					gvr := iamv0.ResourcePermissionInfo.GroupVersionResource()
					dyn.PrependReactor("create", gvr.Resource, func(clienttesting.Action) (bool, runtime.Object, error) {
						return true, nil, tt.permissionErr
					})
				}
				store, legacy, storage, _ := newDatasourceLifecycleStorage(t, tt.mode, permissions)
				obj := &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: namespace}}
				opts := &metav1.CreateOptions{}
				if tt.dryRun {
					opts.DryRun = []string{metav1.DryRunAll}
				}
				created, err := store.Create(ctx, obj, nil, opts)
				require.NoError(t, err)
				require.Equal(t, "test-ds", created.(*datasourceV0.DataSource).Name)
				synctest.Wait()
				require.Equal(t, tt.wantLegacy, legacy.creates == 1)
				require.Equal(t, tt.wantUnified, storage.saved != nil)
				if tt.permissionErr != nil {
					require.NotNil(t, storage.saved, "datasource creation must succeed when IAM is unavailable")
					require.Len(t, dyn.Actions(), 2, "the default permission write was attempted")
					return
				}
				if !tt.wantDefaults {
					require.Empty(t, dyn.Actions())
					return
				}
				grants := []any{
					map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "query"},
					map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "query"},
				}
				if tt.creator != "" {
					grants = append(grants, map[string]any{"kind": string(tt.creator), "name": "stable-actor-uid", "verb": "admin"})
				}
				requireDatasourcePermissionCreate(t, dyn.Actions(), namespace, "test-ds", grants)
			})
		})
	}
}

func TestDatasourceCreatePermissionsPolicyControlsIAMDefaults(t *testing.T) {
	for _, tt := range []struct {
		name        string
		enabled     bool
		policyError error
	}{
		{name: "disabled"},
		{name: "policy error", policyError: errors.New("tenant settings unavailable")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := request.WithNamespace(t.Context(), "stacks-2")
			permissions, dyn := newTestDatasourceResourcePermissions()
			store, provider, storage, _ := newDatasourceLifecycleStorage(t, grafanarest.Mode5, permissions)
			provider.permissionsOnCreation = tt.enabled
			provider.permissionsError = tt.policyError
			obj := &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "stacks-2"}}
			created, err := store.Create(ctx, obj, nil, &metav1.CreateOptions{})
			require.NoError(t, err)
			require.Equal(t, obj.Name, created.(*datasourceV0.DataSource).Name)
			require.NotNil(t, storage.saved)
			require.Empty(t, dyn.Actions())
		})
	}
}

func TestDatasourceStoragePreservesOptionalInterfacesByMode(t *testing.T) {
	permissions, _ := newTestDatasourceResourcePermissions()
	for mode := grafanarest.Mode0; mode <= grafanarest.Mode5; mode++ {
		t.Run(fmt.Sprintf("mode %d", mode), func(t *testing.T) {
			wrapped, _, _, underlying := newDatasourceLifecycleStorage(t, mode, permissions)
			version, hasVersion := underlying.(rest.StorageVersionProvider)
			if hasVersion {
				require.Equal(t, version.StorageVersion(), wrapped.(rest.StorageVersionProvider).StorageVersion())
			} else {
				require.Nil(t, wrapped.(rest.StorageVersionProvider).StorageVersion(), "legacy storage has no version provider")
			}
			resetFields, hasResetFields := underlying.(rest.ResetFieldsStrategy)
			if hasResetFields {
				require.Equal(t, resetFields.GetResetFields(), wrapped.(rest.ResetFieldsStrategy).GetResetFields())
			} else {
				require.Nil(t, wrapped.(rest.ResetFieldsStrategy).GetResetFields(), "legacy storage has no reset strategy")
			}
		})
	}
}

func TestDatasourceStorageDelegatesOptionalOperations(t *testing.T) {
	watchResult := watch.NewFake()
	collectionResult := &unstructured.Unstructured{}
	readinessErr := errors.New("storage is not ready")
	corruptDeleter := &optionalDatasourceGracefulDeleter{}
	inner := &optionalDatasourceStorage{
		watchResult:       watchResult,
		collectionResult:  collectionResult,
		readinessErr:      readinessErr,
		corruptObjDeleter: corruptDeleter,
	}
	wrapped := newPermissionWrapper(inner, nil, nil)

	gotWatch, err := wrapped.(rest.Watcher).Watch(t.Context(), &internalversion.ListOptions{})
	require.NoError(t, err)
	require.Same(t, watchResult, gotWatch)
	gotCollection, err := wrapped.(rest.CollectionDeleter).DeleteCollection(t.Context(), nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{})
	require.NoError(t, err)
	require.Same(t, collectionResult, gotCollection)
	require.True(t, inner.watchCalled)
	require.True(t, inner.collectionDeleteCalled)
	require.ErrorIs(t, wrapped.(rest.StorageWithReadiness).ReadinessCheck(), readinessErr)
	require.Same(t, corruptDeleter, wrapped.(rest.CorruptObjectDeleterProvider).GetCorruptObjDeleter())
}

func TestDatasourceStorageOptionalOperationsReturnUnsupportedErrors(t *testing.T) {
	wrapped := newPermissionWrapper(&commonOnlyDatasourceStorage{}, nil, nil)
	gotWatch, err := wrapped.(rest.Watcher).Watch(t.Context(), &internalversion.ListOptions{})
	require.Nil(t, gotWatch)
	require.ErrorIs(t, err, errWatchUnsupported)
	gotCollection, err := wrapped.(rest.CollectionDeleter).DeleteCollection(t.Context(), nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{})
	require.Nil(t, gotCollection)
	require.EqualError(t, err, "datasource storage does not support collection delete")
	require.NoError(t, wrapped.(rest.StorageWithReadiness).ReadinessCheck())
	require.Nil(t, wrapped.(rest.CorruptObjectDeleterProvider).GetCorruptObjDeleter())
}

type commonOnlyDatasourceStorage struct{ grafanarest.Storage }

type optionalDatasourceStorage struct {
	grafanarest.Storage
	watchResult            watch.Interface
	collectionResult       runtime.Object
	readinessErr           error
	corruptObjDeleter      rest.GracefulDeleter
	watchCalled            bool
	collectionDeleteCalled bool
}

func (s *optionalDatasourceStorage) Watch(context.Context, *internalversion.ListOptions) (watch.Interface, error) {
	s.watchCalled = true
	return s.watchResult, nil
}

func (s *optionalDatasourceStorage) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *internalversion.ListOptions) (runtime.Object, error) {
	s.collectionDeleteCalled = true
	return s.collectionResult, nil
}

func (s *optionalDatasourceStorage) ReadinessCheck() error { return s.readinessErr }

func (s *optionalDatasourceStorage) GetCorruptObjDeleter() rest.GracefulDeleter {
	return s.corruptObjDeleter
}

type optionalDatasourceGracefulDeleter struct{}

func (*optionalDatasourceGracefulDeleter) New() runtime.Object { return &unstructured.Unstructured{} }

func (*optionalDatasourceGracefulDeleter) Delete(context.Context, string, rest.ValidateObjectFunc, *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, nil
}

func TestDatasourceUpdateKeepsCustomPermissions(t *testing.T) {
	for _, tt := range []struct {
		name        string
		mode        grafanarest.DualWriterMode
		noUnifiedDS bool
	}{
		{name: "primary unified update", mode: grafanarest.Mode5},
		{name: "secondary update creates missing mirror", mode: grafanarest.Mode1, noUnifiedDS: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx := request.WithNamespace(t.Context(), "stacks-2")
				permissions, dyn := newTestDatasourceResourcePermissions()
				store, _, storage, _ := newDatasourceLifecycleStorage(t, tt.mode, permissions)
				obj := &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "stacks-2"}}
				created, err := store.Create(ctx, obj, nil, &metav1.CreateOptions{})
				require.NoError(t, err)
				synctest.Wait()
				if tt.noUnifiedDS {
					storage.saved = nil
				}
				dyn.ClearActions()
				updated := created.(*datasourceV0.DataSource).DeepCopy()
				updated.Labels = map[string]string{"label": "new-value"}
				_, wasCreated, err := store.Update(ctx, updated.Name, rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
				require.NoError(t, err)
				require.False(t, wasCreated)
				synctest.Wait()
				require.NotNil(t, storage.saved)
				require.Equal(t, updated.Labels, storage.saved.Labels)
				require.Empty(t, dyn.Actions(), "update must preserve existing grants")
			})
		})
	}
}

func TestDatasourceCreateThroughUpdateSetsDefaults(t *testing.T) {
	for _, tt := range []struct {
		name          string
		permissionErr error
	}{
		{name: "success"},
		{name: "IAM failure preserves persisted result", permissionErr: errors.New("IAM unavailable")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := request.WithNamespace(t.Context(), "stacks-2")
			permissions, dyn := newTestDatasourceResourcePermissions()
			if tt.permissionErr != nil {
				gvr := iamv0.ResourcePermissionInfo.GroupVersionResource()
				dyn.PrependReactor("create", gvr.Resource, func(clienttesting.Action) (bool, runtime.Object, error) {
					return true, nil, tt.permissionErr
				})
			}
			store, _, storage, _ := newDatasourceLifecycleStorage(t, grafanarest.Mode5, permissions)
			obj := &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "stacks-2"}}
			result, wasCreated, err := store.Update(ctx, obj.Name, rest.DefaultUpdatedObjectInfo(obj), nil, nil, true, &metav1.UpdateOptions{})
			require.NoError(t, err)
			require.True(t, wasCreated)
			require.Equal(t, "test-ds", result.(*datasourceV0.DataSource).Name)
			require.NotNil(t, storage.saved)
			require.Equal(t, "test-ds", storage.saved.Name)
			if tt.permissionErr != nil {
				require.Len(t, dyn.Actions(), 2, "the default permission write was attempted")
				return
			}
			requireDatasourcePermissionCreate(t, dyn.Actions(), obj.Namespace, obj.Name, []any{
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "query"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "query"},
			})
		})
	}
}

func TestDatasourceCreateThroughUpdateDoesNotSetDefaultsWhenPersistenceFails(t *testing.T) {
	ctx := request.WithNamespace(t.Context(), "stacks-2")
	permissions, dyn := newTestDatasourceResourcePermissions()
	store, _, storage, _ := newDatasourceLifecycleStorage(t, grafanarest.Mode5, permissions)
	storage.createErr = errors.New("storage unavailable")
	obj := &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "stacks-2"}}

	_, _, err := store.Update(ctx, obj.Name, rest.DefaultUpdatedObjectInfo(obj), nil, nil, true, &metav1.UpdateOptions{})
	require.ErrorIs(t, err, storage.createErr)
	require.Nil(t, storage.saved)
	require.Empty(t, dyn.Actions(), "defaults must wait until the PUT-created datasource is persisted")
}

func requireDatasourcePermissionCreate(t *testing.T, actions []clienttesting.Action, namespace, uid string, grants []any) {
	t.Helper()
	gvr := iamv0.ResourcePermissionInfo.GroupVersionResource()
	gr := datasourceV0.DataSourceResourceInfo.GroupResource()
	rpName := rpclient.Name(gr, uid)
	require.Len(t, actions, 2)
	require.Equal(t, clienttesting.NewGetAction(gvr, namespace, rpName), actions[0])
	require.Equal(t, "create", actions[1].GetVerb())
	require.Equal(t, gvr, actions[1].GetResource())
	require.Equal(t, namespace, actions[1].GetNamespace())
	obj := actions[1].(clienttesting.CreateAction).GetObject().(*unstructured.Unstructured)
	require.Equal(t, rpName, obj.GetName())
	require.Equal(t, namespace, obj.GetNamespace())
	require.Equal(t, map[string]any{
		"resource":    map[string]any{"apiGroup": gr.Group, "resource": gr.Resource, "name": uid},
		"permissions": grants,
	}, obj.Object["spec"])
}

func newDatasourceLifecycleStorage(t *testing.T, mode grafanarest.DualWriterMode, permissions *rpclient.Client) (grafanarest.Storage, *lifecycleDatasourceProvider, *datasourceTestStorage, grafanarest.Storage) {
	t.Helper()
	info := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("test.datasource.grafana.app", "test")
	provider := &lifecycleDatasourceProvider{permissionsOnCreation: true}
	legacy := &legacyStorage{datasources: provider, resourceInfo: &info}
	scheme := runtime.NewScheme()
	addKnownTypes(scheme, info.GroupVersion())
	strategy := grafanaregistry.NewStrategy(scheme, info.GroupVersion())
	storage := &datasourceTestStorage{}
	unified := &registry.Store{
		NewFunc:                  info.NewFunc,
		DefaultQualifiedResource: info.GroupResource(),
		ObjectNameFunc:           func(obj runtime.Object) (string, error) { return meta.NewAccessor().Name(obj) },
		KeyFunc:                  func(_ context.Context, name string) (string, error) { return name, nil },
		CreateStrategy:           strategy,
		UpdateStrategy:           strategy,
		Storage: registry.DryRunnableStorage{
			Storage: storage,
			Codec:   serializer.NewCodecFactory(scheme).LegacyCodec(info.GroupVersion()),
		},
	}
	cfg := dualwrite.NewFakeConfig()
	cfg.UnifiedStorage[info.GroupResource().String()] = setting.UnifiedStorageConfig{DualWriterMode: mode}
	store, err := dualwrite.ProvideServiceForTests(cfg).NewStorage(info.GroupResource(), legacy, unified)
	require.NoError(t, err)
	return newPermissionWrapper(store, permissions, provider.PermissionsOnCreation), provider, storage, store
}

type lifecycleDatasourceProvider struct {
	countingUpdateDatasourceProvider
	creates               int
	permissionsOnCreation bool
	permissionsError      error
}

func (p *lifecycleDatasourceProvider) PermissionsOnCreation(context.Context, string) (bool, error) {
	return p.permissionsOnCreation || p.permissionsError != nil, p.permissionsError
}

func (p *lifecycleDatasourceProvider) CreateDataSource(_ context.Context, ds *datasourceV0.DataSource) (*datasourceV0.DataSource, error) {
	p.creates++
	p.stored = ds.DeepCopy()
	return ds, nil
}

type datasourceTestStorage struct {
	storage.Interface
	saved     *datasourceV0.DataSource
	createErr error
}

func (*datasourceTestStorage) Versioner() storage.Versioner { return storage.APIObjectVersioner{} }

func (s *datasourceTestStorage) Create(_ context.Context, _ string, obj, out runtime.Object, _ uint64) error {
	if s.createErr != nil {
		return s.createErr
	}
	ds := obj.(*datasourceV0.DataSource)
	if ds.Annotations[utils.AnnoKeyGrantPermissions] == utils.AnnoGrantPermissionsDefault {
		return errors.New("missing default permission creator")
	}
	s.saved = ds.DeepCopy()
	s.saved.ResourceVersion = "1"
	*out.(*datasourceV0.DataSource) = *s.saved
	return nil
}

func (s *datasourceTestStorage) Get(_ context.Context, key string, _ storage.GetOptions, out runtime.Object) error {
	if s.saved == nil {
		return storage.NewKeyNotFoundError(key, 0)
	}
	*out.(*datasourceV0.DataSource) = *s.saved.DeepCopy()
	return nil
}

func (s *datasourceTestStorage) GuaranteedUpdate(ctx context.Context, key string, out runtime.Object, ignoreNotFound bool, _ *storage.Preconditions, update storage.UpdateFunc, _ runtime.Object) error {
	var existing datasourceV0.DataSource
	var version uint64
	if s.saved != nil {
		existing = *s.saved.DeepCopy()
		version = 1
	} else if !ignoreNotFound {
		return storage.NewKeyNotFoundError(key, 0)
	}
	obj, _, err := update(&existing, storage.ResponseMeta{ResourceVersion: version})
	if err != nil {
		return err
	}
	if version == 0 {
		return s.Create(ctx, key, obj, out, 0)
	}
	s.saved = obj.(*datasourceV0.DataSource).DeepCopy()
	*out.(*datasourceV0.DataSource) = *s.saved
	return nil
}
