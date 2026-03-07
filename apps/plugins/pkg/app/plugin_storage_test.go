package app

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/registry/rest"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
)

func TestPluginStorageCreateReconcilesChildren(t *testing.T) {
	parent := newParentPlugin("1.0.0")
	mockClient := newMockPluginWriteClient()
	storage := newPluginStorageForTest(t, parent, parent, false, mockClient)

	createdObj, err := storage.Create(context.Background(), parent, rest.ValidateAllObjectFunc, &metav1.CreateOptions{})
	require.NoError(t, err)
	require.IsType(t, &pluginsv0alpha1.Plugin{}, createdObj)

	childA, ok := mockClient.store["child-a"]
	require.True(t, ok)
	require.Equal(t, "1.0.0", childA.Spec.Version)
	require.Equal(t, "parent", *childA.Spec.ParentId)

	childB, ok := mockClient.store["child-b"]
	require.True(t, ok)
	require.Equal(t, "1.0.0", childB.Spec.Version)
	require.Equal(t, "parent", *childB.Spec.ParentId)
}

func TestPluginStorageUpdateReconcilesChildren(t *testing.T) {
	parentUpdated := newParentPlugin("2.0.0")
	mockClient := newMockPluginWriteClient()
	storage := newPluginStorageForTest(t, newParentPlugin("1.0.0"), parentUpdated, false, mockClient)

	updatedObj, created, err := storage.Update(
		context.Background(),
		"parent",
		rest.DefaultUpdatedObjectInfo(parentUpdated),
		rest.ValidateAllObjectFunc,
		rest.ValidateAllObjectUpdateFunc,
		false,
		&metav1.UpdateOptions{},
	)
	require.NoError(t, err)
	require.False(t, created)
	require.IsType(t, &pluginsv0alpha1.Plugin{}, updatedObj)

	childA, ok := mockClient.store["child-a"]
	require.True(t, ok)
	require.Equal(t, "2.0.0", childA.Spec.Version)
	require.Equal(t, "parent", *childA.Spec.ParentId)

	childB, ok := mockClient.store["child-b"]
	require.True(t, ok)
	require.Equal(t, "2.0.0", childB.Spec.Version)
	require.Equal(t, "parent", *childB.Spec.ParentId)
}

func TestPluginStorageUpdateReconcilesExistingChildren(t *testing.T) {
	parentUpdated := newParentPlugin("2.0.0")
	mockClient := newMockPluginWriteClient()
	mockClient.store["child-a"] = &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "child-a",
			Namespace: "default",
			Annotations: map[string]string{
				"plugins.grafana.app/install-source": "child-plugin-reconciler",
			},
			ResourceVersion: "10",
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:       "child-a",
			Version:  "1.0.0",
			ParentId: stringPtr("parent"),
		},
	}

	storage := newPluginStorageForTest(t, newParentPlugin("1.0.0"), parentUpdated, false, mockClient)

	_, created, err := storage.Update(
		context.Background(),
		"parent",
		rest.DefaultUpdatedObjectInfo(parentUpdated),
		rest.ValidateAllObjectFunc,
		rest.ValidateAllObjectUpdateFunc,
		false,
		&metav1.UpdateOptions{},
	)
	require.NoError(t, err)
	require.False(t, created)

	childA, ok := mockClient.store["child-a"]
	require.True(t, ok)
	require.Equal(t, "2.0.0", childA.Spec.Version)
	require.Equal(t, "parent", *childA.Spec.ParentId)
}

func TestPluginStorageCreateDryRunSkipsChildReconcile(t *testing.T) {
	parent := newParentPlugin("1.0.0")
	mockClient := newMockPluginWriteClient()
	storage := newPluginStorageForTest(t, parent, parent, false, mockClient)

	_, err := storage.Create(
		context.Background(),
		parent,
		rest.ValidateAllObjectFunc,
		&metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}},
	)
	require.NoError(t, err)
	require.Empty(t, mockClient.store)
}

func newPluginStorageForTest(t *testing.T, createObj runtime.Object, updateObj runtime.Object, created bool, mockClient *mockPluginWriteClient) *PluginStorage {
	t.Helper()

	mockStorage := &mockPluginStorage{
		createObj: createObj,
		updateObj: updateObj,
		created:   created,
	}

	clientFactory := func(_ context.Context) (*pluginsv0alpha1.PluginClient, error) {
		return pluginsv0alpha1.NewPluginClient(mockClient), nil
	}
	provider := meta.NewProviderManager(&childrenProvider{
		childrenByID: map[string][]string{
			"parent": {"child-a", "child-b"},
		},
	})

	wrapped, err := NewPluginStorage(
		&logging.NoOpLogger{},
		provider,
		clientFactory,
		pluginsv0alpha1.PluginKind().GroupVersionResource().GroupResource(),
		mockStorage,
	)
	require.NoError(t, err)
	storage, ok := wrapped.(*PluginStorage)
	require.True(t, ok)
	return storage
}

func newParentPlugin(version string) *pluginsv0alpha1.Plugin {
	return &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "parent",
			Namespace: "default",
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:      "parent",
			Version: version,
		},
	}
}

func stringPtr(v string) *string {
	return &v
}

type childrenProvider struct {
	childrenByID map[string][]string
}

func (p *childrenProvider) GetMeta(_ context.Context, ref meta.PluginRef) (*meta.Result, error) {
	return &meta.Result{
		Meta: pluginsv0alpha1.MetaSpec{
			Children: p.childrenByID[ref.ID],
		},
		TTL: time.Hour,
	}, nil
}

type mockPluginStorage struct {
	createObj runtime.Object
	updateObj runtime.Object
	created   bool
}

func (m *mockPluginStorage) New() runtime.Object { return &pluginsv0alpha1.Plugin{} }
func (m *mockPluginStorage) Destroy()            {}
func (m *mockPluginStorage) NamespaceScoped() bool {
	return true
}
func (m *mockPluginStorage) GetSingularName() string { return "plugin" }
func (m *mockPluginStorage) NewList() runtime.Object { return &pluginsv0alpha1.PluginList{} }
func (m *mockPluginStorage) List(context.Context, *internalversion.ListOptions) (runtime.Object, error) {
	return &pluginsv0alpha1.PluginList{}, nil
}
func (m *mockPluginStorage) Get(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
	return &pluginsv0alpha1.Plugin{}, nil
}
func (m *mockPluginStorage) Create(context.Context, runtime.Object, rest.ValidateObjectFunc, *metav1.CreateOptions) (runtime.Object, error) {
	return m.createObj, nil
}
func (m *mockPluginStorage) Update(_ context.Context, _ string, _ rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return m.updateObj, m.created, nil
}
func (m *mockPluginStorage) Delete(context.Context, string, rest.ValidateObjectFunc, *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, nil
}
func (m *mockPluginStorage) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *internalversion.ListOptions) (runtime.Object, error) {
	return nil, nil
}
func (m *mockPluginStorage) ConvertToTable(context.Context, runtime.Object, runtime.Object) (*metav1.Table, error) {
	return &metav1.Table{}, nil
}
func (m *mockPluginStorage) Watch(context.Context, *internalversion.ListOptions) (watch.Interface, error) {
	return watch.NewEmptyWatch(), nil
}

type mockPluginWriteClient struct {
	resource.Client
	store map[string]*pluginsv0alpha1.Plugin
}

func newMockPluginWriteClient() *mockPluginWriteClient {
	return &mockPluginWriteClient{store: map[string]*pluginsv0alpha1.Plugin{}}
}

func (m *mockPluginWriteClient) Get(_ context.Context, identifier resource.Identifier) (resource.Object, error) {
	if existing, ok := m.store[identifier.Name]; ok {
		return existing.DeepCopy(), nil
	}
	return nil, apierrors.NewNotFound(schema.GroupResource{Group: pluginsv0alpha1.APIGroup, Resource: "plugins"}, identifier.Name)
}

func (m *mockPluginWriteClient) Create(_ context.Context, identifier resource.Identifier, obj resource.Object, _ resource.CreateOptions) (resource.Object, error) {
	plugin := obj.(*pluginsv0alpha1.Plugin)
	m.store[identifier.Name] = plugin.DeepCopy()
	return plugin.DeepCopy(), nil
}

func (m *mockPluginWriteClient) Update(_ context.Context, identifier resource.Identifier, obj resource.Object, _ resource.UpdateOptions) (resource.Object, error) {
	plugin := obj.(*pluginsv0alpha1.Plugin)
	m.store[identifier.Name] = plugin.DeepCopy()
	return plugin.DeepCopy(), nil
}

func (m *mockPluginWriteClient) Delete(_ context.Context, identifier resource.Identifier, _ resource.DeleteOptions) error {
	delete(m.store, identifier.Name)
	return nil
}
