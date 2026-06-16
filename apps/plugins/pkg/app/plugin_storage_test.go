package app

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
)

func TestPluginStorage_CreateCreatesChildren(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	storage := newTestPluginStorage(t, parentStorage, map[string][]string{
		"parent:1.0.0": {"child-a", "child-b"},
	})

	parent := plugin("default", "parent", "1.0.0", "")
	_, err := storage.(rest.Creater).Create(ctx, parent, nil, &metav1.CreateOptions{})
	require.NoError(t, err)

	requireChild(t, parentStorage, "child-a", "1.0.0", "parent")
	requireChild(t, parentStorage, "child-b", "1.0.0", "parent")
}

func TestPluginStorage_UpdateReconcilesChildren(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	parentStorage.set(childPlugin("default", "child-a", "1.0.0", "parent"))
	parentStorage.set(childPlugin("default", "child-b", "1.0.0", "parent"))
	parentStorage.set(parentPluginWithApplied("default", "parent", "1.0.0", "child-a", "child-b"))
	storage := newTestPluginStorage(t, parentStorage, map[string][]string{
		"parent:2.0.0": {"child-a", "child-c"},
	})

	updatedParent := plugin("default", "parent", "2.0.0", "")
	_, _, err := storage.(rest.Updater).Update(ctx, "parent", rest.DefaultUpdatedObjectInfo(updatedParent), nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)

	requireChild(t, parentStorage, "child-a", "2.0.0", "parent")
	requireChild(t, parentStorage, "child-c", "2.0.0", "parent")
	_, ok := parentStorage.items[storageKey("default", "child-b")]
	require.False(t, ok)

	parent := parentStorage.items[storageKey("default", "parent")]
	require.NotNil(t, parent)
	require.Equal(t, "child-a,child-c", parent.Annotations[appliedChildrenAnnotation])
}

func TestPluginStorage_DeleteCascadesToChildren(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	parentStorage.set(childPlugin("default", "child-a", "1.0.0", "parent"))
	parentStorage.set(childPlugin("default", "child-b", "1.0.0", "parent"))
	parentStorage.set(parentPluginWithApplied("default", "parent", "1.0.0", "child-a", "child-b"))
	// Meta unavailable on Delete is fine — applied annotation is the source of truth.
	storage := newTestPluginStorageWithProvider(t, parentStorage, &fakeMetaProvider{err: fmt.Errorf("metadata unavailable")})

	_, _, err := storage.(rest.GracefulDeleter).Delete(ctx, "parent", nil, &metav1.DeleteOptions{})
	require.NoError(t, err)

	require.NotContains(t, parentStorage.items, storageKey("default", "child-a"))
	require.NotContains(t, parentStorage.items, storageKey("default", "child-b"))
	require.NotContains(t, parentStorage.items, storageKey("default", "parent"))
}

func TestPluginStorage_CreateStampsAppliedChildren(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	storage := newTestPluginStorage(t, parentStorage, map[string][]string{
		"parent:1.0.0": {"child-a", "child-b"},
	})

	parent := plugin("default", "parent", "1.0.0", "")
	_, err := storage.(rest.Creater).Create(ctx, parent, nil, &metav1.CreateOptions{})
	require.NoError(t, err)

	persistedParent := parentStorage.items[storageKey("default", "parent")]
	require.NotNil(t, persistedParent)
	require.Equal(t, "child-a,child-b", persistedParent.Annotations[appliedChildrenAnnotation])
}

// --- Create edge cases ---

func TestPluginStorage_CreateMetaUnavailable_OmitsAnnotation(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	storage := newTestPluginStorageWithProvider(t, parentStorage, &fakeMetaProvider{err: fmt.Errorf("metadata unavailable")})

	parent := plugin("default", "parent", "1.0.0", "")
	_, err := storage.(rest.Creater).Create(ctx, parent, nil, &metav1.CreateOptions{})
	require.NoError(t, err)

	persisted := parentStorage.items[storageKey("default", "parent")]
	require.NotNil(t, persisted)
	require.NotContains(t, persisted.Annotations, appliedChildrenAnnotation,
		"meta unavailable on Create with no previous parent must not stamp an annotation")
	require.Len(t, parentStorage.items, 1, "no children should be created when meta is unavailable")
}

func TestPluginStorage_CreateMetaNotFound_OmitsAnnotation(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	storage := newTestPluginStorageWithProvider(t, parentStorage, &fakeMetaProvider{err: meta.ErrMetaNotFound})

	parent := plugin("default", "parent", "1.0.0", "")
	_, err := storage.(rest.Creater).Create(ctx, parent, nil, &metav1.CreateOptions{})
	require.NoError(t, err)

	persisted := parentStorage.items[storageKey("default", "parent")]
	require.NotNil(t, persisted)
	require.NotContains(t, persisted.Annotations, appliedChildrenAnnotation)
	require.Len(t, parentStorage.items, 1)
}

func TestPluginStorage_CreateEmptyChildren_StampsEmpty(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	storage := newTestPluginStorage(t, parentStorage, map[string][]string{
		"parent:1.0.0": {},
	})

	parent := plugin("default", "parent", "1.0.0", "")
	_, err := storage.(rest.Creater).Create(ctx, parent, nil, &metav1.CreateOptions{})
	require.NoError(t, err)

	persisted := parentStorage.items[storageKey("default", "parent")]
	require.NotNil(t, persisted)
	require.Equal(t, "", persisted.Annotations[appliedChildrenAnnotation],
		"empty desired children should stamp an empty annotation value")
	require.Len(t, parentStorage.items, 1, "no children should be created")
}

func TestPluginStorage_CreateAlreadyExists_PropagatesError(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	parentStorage.set(plugin("default", "parent", "1.0.0", ""))
	storage := newTestPluginStorage(t, parentStorage, map[string][]string{
		"parent:1.0.0": {"child-a"},
	})

	_, err := storage.(rest.Creater).Create(ctx, plugin("default", "parent", "1.0.0", ""), nil, &metav1.CreateOptions{})
	require.Error(t, err)
	require.True(t, errorsK8s.IsAlreadyExists(err))
	require.NotContains(t, parentStorage.items, storageKey("default", "child-a"),
		"no children should be created when the parent Create fails")
}

// --- Update edge cases ---

func TestPluginStorage_UpdateChildPlugin_SkipsCascade(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	parentStorage.set(childPlugin("default", "child", "1.0.0", "parent"))
	storage := newTestPluginStorage(t, parentStorage, map[string][]string{
		"child:2.0.0": {"grandchild"},
	})

	updated := childPlugin("default", "child", "2.0.0", "parent")
	_, _, err := storage.(rest.Updater).Update(ctx, "child", rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)

	persisted := parentStorage.items[storageKey("default", "child")]
	require.NotNil(t, persisted)
	require.NotContains(t, persisted.Annotations, appliedChildrenAnnotation,
		"updates on child plugins should not stamp the applied-children annotation")
	require.NotContains(t, parentStorage.items, storageKey("default", "grandchild"))
}

func TestPluginStorage_UpdateMetaUnavailable_PreservesAnnotation(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	parentStorage.set(childPlugin("default", "child-a", "1.0.0", "parent"))
	parentStorage.set(childPlugin("default", "child-b", "1.0.0", "parent"))
	parentStorage.set(parentPluginWithApplied("default", "parent", "1.0.0", "child-a", "child-b"))
	storage := newTestPluginStorageWithProvider(t, parentStorage, &fakeMetaProvider{err: fmt.Errorf("metadata unavailable")})

	updatedParent := plugin("default", "parent", "2.0.0", "")
	_, _, err := storage.(rest.Updater).Update(ctx, "parent", rest.DefaultUpdatedObjectInfo(updatedParent), nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)

	persisted := parentStorage.items[storageKey("default", "parent")]
	require.NotNil(t, persisted)
	require.Equal(t, "child-a,child-b", persisted.Annotations[appliedChildrenAnnotation],
		"meta failure on Update must preserve the previous applied-children annotation")
	require.Contains(t, parentStorage.items, storageKey("default", "child-a"),
		"child-a must survive a meta-failed Update")
	require.Contains(t, parentStorage.items, storageKey("default", "child-b"),
		"child-b must survive a meta-failed Update")
}

func TestPluginStorage_UpdateSameVersion_UpsertsChildAndDoesNotDelete(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	parentStorage.set(childPlugin("default", "child-a", "1.0.0", "parent"))
	parentStorage.set(parentPluginWithApplied("default", "parent", "1.0.0", "child-a"))
	storage := newTestPluginStorage(t, parentStorage, map[string][]string{
		"parent:1.0.0": {"child-a"},
	})

	updatedParent := plugin("default", "parent", "1.0.0", "")
	_, _, err := storage.(rest.Updater).Update(ctx, "parent", rest.DefaultUpdatedObjectInfo(updatedParent), nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)

	require.Contains(t, parentStorage.items, storageKey("default", "child-a"))
	require.Equal(t, 1, parentStorage.updateCalls[storageKey("default", "child-a")],
		"existing desired children must still be updated so downstream hooks can reconcile")
	require.Equal(t, "child-a", parentStorage.items[storageKey("default", "parent")].Annotations[appliedChildrenAnnotation])
}

func TestPluginStorage_UpdateNoPreviousApplied_StampsNew(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	parentStorage.set(plugin("default", "parent", "1.0.0", ""))
	storage := newTestPluginStorage(t, parentStorage, map[string][]string{
		"parent:1.0.0": {"child-a"},
	})

	updatedParent := plugin("default", "parent", "1.0.0", "")
	_, _, err := storage.(rest.Updater).Update(ctx, "parent", rest.DefaultUpdatedObjectInfo(updatedParent), nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)

	persisted := parentStorage.items[storageKey("default", "parent")]
	require.Equal(t, "child-a", persisted.Annotations[appliedChildrenAnnotation])
	requireChild(t, parentStorage, "child-a", "1.0.0", "parent")
}

// TestPluginStorage_UpdateMetaUnavailableNoPriorAnnotation_PreservesChildren
// guards the label-based cleanup: a parent can own children (by label) yet have
// no applied-children annotation (e.g. it was created while meta was down). A
// meta-failed Update leaves the desired set unknown, so cleanup must be skipped
// rather than treating "no annotation" as "no children" and wiping them.
func TestPluginStorage_UpdateMetaUnavailableNoPriorAnnotation_PreservesChildren(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	parentStorage.set(childPlugin("default", "child-a", "1.0.0", "parent"))
	parentStorage.set(plugin("default", "parent", "1.0.0", ""))
	storage := newTestPluginStorageWithProvider(t, parentStorage, &fakeMetaProvider{err: fmt.Errorf("metadata unavailable")})

	updatedParent := plugin("default", "parent", "2.0.0", "")
	_, _, err := storage.(rest.Updater).Update(ctx, "parent", rest.DefaultUpdatedObjectInfo(updatedParent), nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)

	require.Contains(t, parentStorage.items, storageKey("default", "child-a"),
		"children must survive an Update whose desired set is unknown")
	persisted := parentStorage.items[storageKey("default", "parent")]
	require.NotContains(t, persisted.Annotations, appliedChildrenAnnotation)
}

// --- Delete edge cases ---

func TestPluginStorage_DeleteChildPlugin_SkipsCascade(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	// child carries a misleading applied-children annotation; cascade must
	// still be skipped because the target itself is a child.
	misleadingChild := childPlugin("default", "child", "1.0.0", "parent")
	misleadingChild.Annotations = map[string]string{appliedChildrenAnnotation: "grandchild"}
	parentStorage.set(misleadingChild)
	parentStorage.set(plugin("default", "grandchild", "1.0.0", ""))
	storage := newTestPluginStorage(t, parentStorage, nil)

	_, _, err := storage.(rest.GracefulDeleter).Delete(ctx, "child", nil, &metav1.DeleteOptions{})
	require.NoError(t, err)

	require.NotContains(t, parentStorage.items, storageKey("default", "child"))
	require.Contains(t, parentStorage.items, storageKey("default", "grandchild"),
		"deleting a child plugin must not cascade to anything pointed at by its applied-children")
}

func TestPluginStorage_DeleteParentNoAnnotation_NoCascade(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	parentStorage.set(plugin("default", "parent", "1.0.0", ""))
	parentStorage.set(childPlugin("default", "child-a", "1.0.0", "parent"))
	storage := newTestPluginStorage(t, parentStorage, nil)

	_, _, err := storage.(rest.GracefulDeleter).Delete(ctx, "parent", nil, &metav1.DeleteOptions{})
	require.NoError(t, err)

	require.NotContains(t, parentStorage.items, storageKey("default", "parent"))
	require.Contains(t, parentStorage.items, storageKey("default", "child-a"),
		"with no applied-children annotation we have no record to clean up — the child should remain")
}

func TestPluginStorage_DeleteToleratesMissingChild(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	parentStorage.set(parentPluginWithApplied("default", "parent", "1.0.0", "child-a", "child-b"))
	parentStorage.set(childPlugin("default", "child-a", "1.0.0", "parent"))
	// child-b is in the applied annotation but already removed out of band.
	storage := newTestPluginStorage(t, parentStorage, nil)

	_, _, err := storage.(rest.GracefulDeleter).Delete(ctx, "parent", nil, &metav1.DeleteOptions{})
	require.NoError(t, err, "missing child should be tolerated by the cascade")
	require.NotContains(t, parentStorage.items, storageKey("default", "parent"))
	require.NotContains(t, parentStorage.items, storageKey("default", "child-a"))
}

func TestPluginStorage_DeleteNonExistentParent_ReturnsNotFound(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	storage := newTestPluginStorage(t, parentStorage, nil)

	_, _, err := storage.(rest.GracefulDeleter).Delete(ctx, "parent", nil, &metav1.DeleteOptions{})
	require.Error(t, err)
	require.True(t, errorsK8s.IsNotFound(err))
}

func TestPluginStorage_SkipsChildPluginWrites(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	storage := newTestPluginStorage(t, parentStorage, map[string][]string{
		"child:1.0.0": {"grandchild"},
	})

	child := plugin("default", "child", "1.0.0", "parent")
	_, err := storage.(rest.Creater).Create(ctx, child, nil, &metav1.CreateOptions{})
	require.NoError(t, err)

	require.NotContains(t, parentStorage.items, storageKey("default", "grandchild"))
}

func TestPluginStorage_CreatedChildrenHaveParentLabel(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")
	parentStorage := newFakePluginRESTStorage()
	storage := newTestPluginStorage(t, parentStorage, map[string][]string{
		"parent:1.0.0": {"child-a"},
	})

	parent := plugin("default", "parent", "1.0.0", "")
	parent.UID = "parent-uid"
	_, err := storage.(rest.Creater).Create(ctx, parent, nil, &metav1.CreateOptions{})
	require.NoError(t, err)

	child := parentStorage.items[storageKey("default", "child-a")]
	require.NotNil(t, child)
	require.Equal(t, "parent", child.Labels[parentIDLabel])
	require.Empty(t, child.OwnerReferences)
}

func TestPluginStorage_WrapperRejectsIncompleteStorage(t *testing.T) {
	_, err := newPluginStorage(&partialPluginRESTStorage{}, &logging.NoOpLogger{}, meta.NewProviderManager(&fakeMetaProvider{}), nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "must be *genericregistry.Store")
}

func TestPluginStorage_DecoratorWrapsDefaultProvider(t *testing.T) {
	provider := &recordingPluginStorageAfterHookProvider{}
	var gotBase PluginStorageAfterHookProvider
	decorate := func(base PluginStorageAfterHookProvider) PluginStorageAfterHookProvider {
		gotBase = base
		return provider
	}
	storage, err := newPluginStorage(&genericregistry.Store{}, &logging.NoOpLogger{}, meta.NewProviderManager(&fakeMetaProvider{
		children: map[string][]string{
			"parent:1.0.0": {"child"},
		},
	}), decorate)
	require.NoError(t, err)

	// The decorator receives the default after provider, built around the store.
	require.IsType(t, &pluginStorageHookProvider{}, gotBase)

	store := storage.(*genericregistry.Store)
	parent := plugin("default", "parent", "1.0.0", "")
	finish, err := store.BeginCreate(context.Background(), parent, &metav1.CreateOptions{})
	require.NoError(t, err)
	finish(context.Background(), true)
	require.Equal(t, "child", parent.Annotations[appliedChildrenAnnotation])
	store.AfterCreate(parent, &metav1.CreateOptions{})

	updated := plugin("default", "parent", "1.0.0", "")
	finish, err = store.BeginUpdate(context.Background(), updated, plugin("default", "parent", "0.9.0", ""), &metav1.UpdateOptions{})
	require.NoError(t, err)
	finish(context.Background(), true)
	require.Equal(t, "child", updated.Annotations[appliedChildrenAnnotation])
	store.AfterUpdate(updated, &metav1.UpdateOptions{})
	store.AfterDelete(updated, &metav1.DeleteOptions{})

	require.Equal(t, []string{
		"afterCreate",
		"afterUpdate",
		"afterDelete",
	}, provider.calls)
}

func newTestPluginStorage(t *testing.T, parentStorage *fakePluginRESTStorage, children map[string][]string) rest.Storage {
	t.Helper()
	return newTestPluginStorageWithProvider(t, parentStorage, &fakeMetaProvider{children: children})
}

func newTestPluginStorageWithProvider(t *testing.T, parentStorage *fakePluginRESTStorage, provider meta.Provider) rest.Storage {
	t.Helper()
	return newHookTestStorage(parentStorage, &logging.NoOpLogger{}, meta.NewProviderManager(provider))
}

func requireChild(t *testing.T, storage *fakePluginRESTStorage, name, version, parentID string) {
	t.Helper()
	child, ok := storage.items[storageKey("default", name)]
	require.True(t, ok)
	require.Equal(t, version, child.Spec.Version)
	require.NotNil(t, child.Spec.ParentId)
	require.Equal(t, parentID, *child.Spec.ParentId)
	require.Equal(t, parentID, child.Labels[parentIDLabel])
	require.Equal(t, install.SourceChildPlugin, child.Annotations[install.PluginInstallSourceAnnotation])
}

func plugin(namespace, id, version, parentID string) *pluginsv0alpha1.Plugin {
	p := &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      id,
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:      id,
			Version: version,
		},
	}
	if parentID != "" {
		p.Spec.ParentId = &parentID
	}
	return p
}

// childPlugin builds a pre-existing child plugin record with the parent-id
// label set, mirroring what upsertChildPlugin would produce.
func childPlugin(namespace, id, version, parentID string) *pluginsv0alpha1.Plugin {
	p := plugin(namespace, id, version, parentID)
	p.Labels = map[string]string{parentIDLabel: parentID}
	return p
}

// parentPluginWithApplied builds a parent plugin pre-stamped with the
// applied-children annotation, mirroring the state left by a previous
// reconcile.
func parentPluginWithApplied(namespace, id, version string, applied ...string) *pluginsv0alpha1.Plugin {
	p := plugin(namespace, id, version, "")
	if len(applied) > 0 {
		p.Annotations = map[string]string{appliedChildrenAnnotation: strings.Join(applied, ",")}
	}
	return p
}

type fakeMetaProvider struct {
	children map[string][]string
	err      error
}

func (p *fakeMetaProvider) Name() string {
	return "fake"
}

func (p *fakeMetaProvider) GetMeta(_ context.Context, ref meta.PluginRef) (*meta.Result, error) {
	if p.err != nil {
		return nil, p.err
	}
	return &meta.Result{
		Meta: pluginsv0alpha1.MetaSpec{
			Children: p.children[ref.ID+":"+ref.Version],
		},
		TTL: time.Minute,
	}, nil
}

type hookTestStorage struct {
	*fakePluginRESTStorage
	hooks *pluginStorageHookProvider
}

func newHookTestStorage(storage *fakePluginRESTStorage, logger logging.Logger, metaManager *meta.ProviderManager) *hookTestStorage {
	return &hookTestStorage{
		fakePluginRESTStorage: storage,
		hooks:                 NewDefaultPluginStorageHookProvider(storage, logger, metaManager).(*pluginStorageHookProvider),
	}
}

func (s *hookTestStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if plugin, ok := obj.(*pluginsv0alpha1.Plugin); ok && !IsChildPlugin(plugin) {
		normalizePluginID(plugin)
		s.hooks.stampDesiredChildren(ctx, plugin, nil)
	}

	created, err := s.fakePluginRESTStorage.Create(ctx, obj, createValidation, options)
	if err != nil {
		return created, err
	}

	plugin, ok := created.(*pluginsv0alpha1.Plugin)
	if !ok || IsChildPlugin(plugin) {
		return created, nil
	}
	normalizePluginID(plugin)

	if err := s.hooks.reconcileChildren(ctx, plugin); err != nil {
		return created, err
	}
	return created, nil
}

func (s *hookTestStorage) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	wrappedObjInfo := &testStampingObjInfo{inner: objInfo, transform: func(ctx context.Context, newObj, oldObj runtime.Object) (runtime.Object, error) {
		if plugin, ok := newObj.(*pluginsv0alpha1.Plugin); ok && !IsChildPlugin(plugin) {
			normalizePluginID(plugin)
			oldPlugin, _ := oldObj.(*pluginsv0alpha1.Plugin)
			s.hooks.stampDesiredChildren(ctx, plugin, oldPlugin)
		}
		return newObj, nil
	}}

	updated, created, err := s.fakePluginRESTStorage.Update(ctx, name, wrappedObjInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		return updated, created, err
	}

	plugin, ok := updated.(*pluginsv0alpha1.Plugin)
	if !ok || IsChildPlugin(plugin) {
		return updated, created, nil
	}
	normalizePluginID(plugin)

	if err := s.hooks.reconcileChildren(ctx, plugin); err != nil {
		return updated, created, err
	}
	return updated, created, nil
}

func (s *hookTestStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	plugin, err := s.hooks.getPlugin(ctx, name)
	if err != nil && !errorsK8s.IsNotFound(err) {
		return nil, false, err
	}

	var children []string
	if plugin != nil && !IsChildPlugin(plugin) {
		children = parseAppliedChildren(plugin.Annotations)
	}

	deleted, immediately, err := s.fakePluginRESTStorage.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		return deleted, immediately, err
	}

	for _, childID := range children {
		if _, _, err := s.fakePluginRESTStorage.Delete(ctx, childID, nil, &metav1.DeleteOptions{}); err != nil && !errorsK8s.IsNotFound(err) {
			s.hooks.logger.WithContext(ctx).Error("Failed to delete child plugin", "error", err, "childPluginId", childID)
			return deleted, immediately, err
		}
	}
	return deleted, immediately, nil
}

type testStampingObjInfo struct {
	inner     rest.UpdatedObjectInfo
	transform rest.TransformFunc
}

func (t *testStampingObjInfo) Preconditions() *metav1.Preconditions {
	return t.inner.Preconditions()
}

func (t *testStampingObjInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	newObj, err := t.inner.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, err
	}
	return t.transform(ctx, newObj, oldObj)
}

type fakePluginRESTStorage struct {
	items       map[string]*pluginsv0alpha1.Plugin
	updateCalls map[string]int
}

func newFakePluginRESTStorage() *fakePluginRESTStorage {
	return &fakePluginRESTStorage{
		items:       map[string]*pluginsv0alpha1.Plugin{},
		updateCalls: map[string]int{},
	}
}

func (s *fakePluginRESTStorage) New() runtime.Object {
	return &pluginsv0alpha1.Plugin{}
}

func (s *fakePluginRESTStorage) NewList() runtime.Object {
	return &pluginsv0alpha1.PluginList{}
}

func (s *fakePluginRESTStorage) Destroy() {}

func (s *fakePluginRESTStorage) ReadinessCheck() error {
	return nil
}

func (s *fakePluginRESTStorage) NamespaceScoped() bool {
	return true
}

func (s *fakePluginRESTStorage) GetSingularName() string {
	return "plugin"
}

func (s *fakePluginRESTStorage) ConvertToTable(_ context.Context, _ runtime.Object, _ runtime.Object) (*metav1.Table, error) {
	return &metav1.Table{}, nil
}

func (s *fakePluginRESTStorage) StorageVersion() runtime.GroupVersioner {
	return schema.GroupVersion{Group: pluginsv0alpha1.APIGroup, Version: pluginsv0alpha1.APIVersion}
}

func (s *fakePluginRESTStorage) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	return map[fieldpath.APIVersion]*fieldpath.Set{}
}

func (s *fakePluginRESTStorage) GetCorruptObjDeleter() rest.GracefulDeleter {
	return s
}

func (s *fakePluginRESTStorage) DeleteReturnsDeletedObject() bool {
	return true
}

func (s *fakePluginRESTStorage) Watch(_ context.Context, _ *internalversion.ListOptions) (watch.Interface, error) {
	return watch.NewEmptyWatch(), nil
}

func (s *fakePluginRESTStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	requestNamespace, _ := request.NamespaceFrom(ctx)
	selector := labels.Everything()
	if options != nil && options.LabelSelector != nil {
		selector = options.LabelSelector
	}
	list := &pluginsv0alpha1.PluginList{}
	for _, item := range s.items {
		if requestNamespace != "" && item.Namespace != requestNamespace {
			continue
		}
		if !selector.Matches(labels.Set(item.Labels)) {
			continue
		}
		list.Items = append(list.Items, *item.DeepCopy())
	}
	return list, nil
}

func (s *fakePluginRESTStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	item, ok := s.items[storageKeyFromContext(ctx, name)]
	if !ok {
		return nil, notFound(name)
	}
	return item.DeepCopy(), nil
}

func (s *fakePluginRESTStorage) Create(ctx context.Context, obj runtime.Object, _ rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	plugin := obj.(*pluginsv0alpha1.Plugin).DeepCopy()
	if plugin.Namespace == "" {
		plugin.Namespace, _ = request.NamespaceFrom(ctx)
	}
	key := storageKey(plugin.Namespace, plugin.Name)
	if _, ok := s.items[key]; ok {
		return nil, errorsK8s.NewAlreadyExists(schema.GroupResource{Group: pluginsv0alpha1.APIGroup, Resource: "plugins"}, plugin.Name)
	}
	s.items[key] = plugin
	return plugin.DeepCopy(), nil
}

func (s *fakePluginRESTStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	old := &pluginsv0alpha1.Plugin{}
	key := storageKeyFromContext(ctx, name)
	if existing, ok := s.items[key]; ok {
		old = existing.DeepCopy()
	}
	updated, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}
	plugin := updated.(*pluginsv0alpha1.Plugin).DeepCopy()
	if plugin.Namespace == "" {
		plugin.Namespace, _ = request.NamespaceFrom(ctx)
	}
	s.updateCalls[storageKey(plugin.Namespace, plugin.Name)]++
	s.items[storageKey(plugin.Namespace, plugin.Name)] = plugin
	return plugin.DeepCopy(), false, nil
}

func (s *fakePluginRESTStorage) Delete(ctx context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	key := storageKeyFromContext(ctx, name)
	item, ok := s.items[key]
	if !ok {
		return nil, false, notFound(name)
	}
	delete(s.items, key)
	return item.DeepCopy(), true, nil
}

func (s *fakePluginRESTStorage) DeleteCollection(ctx context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	list := &pluginsv0alpha1.PluginList{}
	namespace, _ := request.NamespaceFrom(ctx)
	for key, item := range s.items {
		if item.Namespace != namespace {
			continue
		}
		list.Items = append(list.Items, *item.DeepCopy())
		delete(s.items, key)
	}
	return list, nil
}

func (s *fakePluginRESTStorage) set(plugin *pluginsv0alpha1.Plugin) {
	s.items[storageKey(plugin.Namespace, plugin.Name)] = plugin.DeepCopy()
}

func storageKeyFromContext(ctx context.Context, name string) string {
	namespace, _ := request.NamespaceFrom(ctx)
	return storageKey(namespace, name)
}

func storageKey(namespace, name string) string {
	return namespace + "/" + name
}

// partialPluginRESTStorage implements rest.Storage but is missing the
// optional capabilities (Scoper, SingularNameProvider, etc.). Used to verify
// newPluginStorage rejects incomplete storages with one clear error.
type partialPluginRESTStorage struct{}

func (s *partialPluginRESTStorage) New() runtime.Object { return &pluginsv0alpha1.Plugin{} }
func (s *partialPluginRESTStorage) Destroy()            {}

type recordingPluginStorageAfterHookProvider struct {
	calls []string
}

func (p *recordingPluginStorageAfterHookProvider) AfterCreate(context.Context, *pluginsv0alpha1.Plugin, *metav1.CreateOptions) error {
	p.calls = append(p.calls, "afterCreate")
	return nil
}

func (p *recordingPluginStorageAfterHookProvider) AfterUpdate(context.Context, *pluginsv0alpha1.Plugin, *metav1.UpdateOptions) error {
	p.calls = append(p.calls, "afterUpdate")
	return nil
}

func (p *recordingPluginStorageAfterHookProvider) AfterDelete(context.Context, *pluginsv0alpha1.Plugin, *metav1.DeleteOptions) error {
	p.calls = append(p.calls, "afterDelete")
	return nil
}

func notFound(name string) error {
	return errorsK8s.NewNotFound(schema.GroupResource{Group: pluginsv0alpha1.APIGroup, Resource: "plugins"}, name)
}
