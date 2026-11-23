package datasource

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/request"
	registry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

type defaultPermissionsCall struct {
	namespace   string
	name        string
	permissions []iamv0.ResourcePermissionspecPermission
}

type recordingPermissionsLifecycle struct {
	deleted [][2]string
	created []defaultPermissionsCall
	err     error
}

func (r *recordingPermissionsLifecycle) DeletePermissions(_ context.Context, namespace, name string) error {
	r.deleted = append(r.deleted, [2]string{namespace, name})
	return nil
}

func (r *recordingPermissionsLifecycle) SetDefault(_ context.Context, namespace, name string, permissions []iamv0.ResourcePermissionspecPermission) error {
	r.created = append(r.created, defaultPermissionsCall{namespace, name, permissions})
	return r.err
}

func TestAfterDeleteDeletesPermissions(t *testing.T) {
	lifecycle := &recordingPermissionsLifecycle{}
	b := &DataSourceAPIBuilder{permissionsLifecycle: lifecycle}

	b.afterDelete(&datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Namespace: "stacks-2", Name: "ds-uid"}}, nil)

	require.Equal(t, [][2]string{{"stacks-2", "ds-uid"}}, lifecycle.deleted)
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
		annotated     bool
		dryRun        bool
		permissionErr error
	}{
		{name: "legacy", mode: grafanarest.Mode0, wantLegacy: true},
		{name: "mode 1", mode: grafanarest.Mode1, wantLegacy: true, wantUnified: true},
		{name: "mode 2", mode: grafanarest.Mode2, wantLegacy: true, wantUnified: true},
		{name: "mode 3", mode: grafanarest.Mode3, wantLegacy: true, wantUnified: true},
		{name: "mode 4 user", mode: grafanarest.Mode4, actor: authlib.TypeUser, creator: iamv0.ResourcePermissionSpecPermissionKindUser, wantUnified: true, wantDefaults: true},
		{name: "mode 5 service account", mode: grafanarest.Mode5, actor: authlib.TypeServiceAccount, creator: iamv0.ResourcePermissionSpecPermissionKindServiceAccount, wantUnified: true, wantDefaults: true},
		{name: "provisioner", mode: grafanarest.Mode5, actor: authlib.TypeAccessPolicy, wantUnified: true, wantDefaults: true},
		{name: "explicit default annotation", mode: grafanarest.Mode5, annotated: true, wantUnified: true, wantDefaults: true},
		{name: "dry run", mode: grafanarest.Mode5, actor: authlib.TypeUser, dryRun: true},
		{name: "IAM error after persistence", mode: grafanarest.Mode5, wantUnified: true, wantDefaults: true, permissionErr: errors.New("IAM unavailable")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				const namespace = "stacks-2"
				ctx := request.WithNamespace(t.Context(), namespace)
				if tt.actor != "" {
					ctx = authlib.WithAuthInfo(ctx, &identity.StaticRequester{Type: tt.actor, UserID: 12, UserUID: "stable-actor-uid"})
				}
				lifecycle := &recordingPermissionsLifecycle{err: tt.permissionErr}
				store, legacy, storage := newDatasourceLifecycleStorage(t, tt.mode, lifecycle)
				obj := &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: namespace}}
				if tt.annotated {
					obj.Annotations = map[string]string{utils.AnnoKeyGrantPermissions: utils.AnnoGrantPermissionsDefault}
				}
				opts := &metav1.CreateOptions{}
				if tt.dryRun {
					opts.DryRun = []string{metav1.DryRunAll}
				}
				_, err := store.Create(ctx, obj, nil, opts)
				if tt.permissionErr != nil {
					require.ErrorIs(t, err, tt.permissionErr)
				} else {
					require.NoError(t, err)
				}
				synctest.Wait()
				require.Equal(t, tt.wantLegacy, legacy.creates == 1)
				require.Equal(t, tt.wantUnified, storage.saved != nil)
				if tt.annotated {
					require.NotContains(t, storage.saved.Annotations, utils.AnnoKeyGrantPermissions)
				}
				if !tt.wantDefaults {
					require.Empty(t, lifecycle.created)
					return
				}
				permissions := []iamv0.ResourcePermissionspecPermission{
					{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Viewer", Verb: "query"},
					{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Editor", Verb: "query"},
				}
				if tt.creator != "" {
					permissions = append(permissions, iamv0.ResourcePermissionspecPermission{Kind: tt.creator, Name: "stable-actor-uid", Verb: "admin"})
				}
				require.Equal(t, []defaultPermissionsCall{{namespace, "test-ds", permissions}}, lifecycle.created)
			})
		})
	}
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
				lifecycle := &recordingPermissionsLifecycle{}
				store, _, storage := newDatasourceLifecycleStorage(t, tt.mode, lifecycle)
				obj := &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "stacks-2"}}
				created, err := store.Create(ctx, obj, nil, &metav1.CreateOptions{})
				require.NoError(t, err)
				synctest.Wait()
				if tt.noUnifiedDS {
					storage.saved = nil
				}
				initialCalls := len(lifecycle.created)
				updated := created.(*datasourceV0.DataSource).DeepCopy()
				updated.Labels = map[string]string{"label": "new-value"}
				_, wasCreated, err := store.Update(ctx, updated.Name, rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
				require.NoError(t, err)
				require.False(t, wasCreated)
				synctest.Wait()
				require.NotNil(t, storage.saved)
				require.Equal(t, updated.Labels, storage.saved.Labels)
				require.Len(t, lifecycle.created, initialCalls, "update must preserve existing grants")
			})
		})
	}
}

func TestDatasourceCreateThroughUpdateSetsDefaults(t *testing.T) {
	ctx := request.WithNamespace(t.Context(), "stacks-2")
	lifecycle := &recordingPermissionsLifecycle{}
	store, _, storage := newDatasourceLifecycleStorage(t, grafanarest.Mode5, lifecycle)
	obj := &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "stacks-2"}}
	_, wasCreated, err := store.Update(ctx, obj.Name, rest.DefaultUpdatedObjectInfo(obj), nil, nil, true, &metav1.UpdateOptions{})
	require.NoError(t, err)
	require.True(t, wasCreated)
	require.NotNil(t, storage.saved)
	require.Len(t, lifecycle.created, 1)
}

func newDatasourceLifecycleStorage(t *testing.T, mode grafanarest.DualWriterMode, permissions *recordingPermissionsLifecycle) (grafanarest.Storage, *lifecycleDatasourceProvider, *datasourceTestStorage) {
	t.Helper()
	info := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("test.datasource.grafana.app", "test")
	provider := &lifecycleDatasourceProvider{}
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
	store, err := dualwrite.ProvideServiceForTests(cfg).NewStorage(info.GroupResource(), legacy, &unifiedDatasourceStorage{Store: unified, permissions: permissions})
	require.NoError(t, err)
	return store, provider, storage
}

type lifecycleDatasourceProvider struct {
	countingUpdateDatasourceProvider
	creates int
}

func (p *lifecycleDatasourceProvider) CreateDataSource(_ context.Context, ds *datasourceV0.DataSource) (*datasourceV0.DataSource, error) {
	p.creates++
	p.stored = ds.DeepCopy()
	return ds, nil
}

type datasourceTestStorage struct {
	storage.Interface
	saved *datasourceV0.DataSource
}

func (*datasourceTestStorage) Versioner() storage.Versioner { return storage.APIObjectVersioner{} }

func (s *datasourceTestStorage) Create(_ context.Context, _ string, obj, out runtime.Object, _ uint64) error {
	s.saved = obj.(*datasourceV0.DataSource).DeepCopy()
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

func (s *datasourceTestStorage) GuaranteedUpdate(_ context.Context, key string, out runtime.Object, ignoreNotFound bool, _ *storage.Preconditions, update storage.UpdateFunc, _ runtime.Object) error {
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
	s.saved = obj.(*datasourceV0.DataSource).DeepCopy()
	*out.(*datasourceV0.DataSource) = *s.saved
	return nil
}
