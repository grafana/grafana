package app

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

func TestChildReconcilerInformerSupplier(t *testing.T) {
	t.Run("uses optimized informer by default", func(t *testing.T) {
		inf, err := childReconcilerInformerSupplier(nil, nil)(
			pluginsv0alpha1.PluginKind(),
			fakeClientGenerator{client: fakeResourceClient{}},
			operator.InformerOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "*cache.cache", nestedInformerStoreType(t, inf))
	})

	t.Run("uses memcached informer when configured", func(t *testing.T) {
		selector, err := simple.NewMemcachedHostList([]string{"127.0.0.1:11211"})
		require.NoError(t, err)

		inf, err := childReconcilerInformerSupplier(selector, nil)(
			pluginsv0alpha1.PluginKind(),
			fakeClientGenerator{client: fakeResourceClient{}},
			operator.InformerOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "*operator.MemcachedStore", nestedInformerStoreType(t, inf))
	})

	t.Run("gates plugin informer when ownership filter exposes readiness", func(t *testing.T) {
		gate := mockReadinessGate{ready: make(chan struct{})}

		inf, err := childReconcilerInformerSupplier(nil, gate)(
			pluginsv0alpha1.PluginKind(),
			fakeClientGenerator{client: fakeResourceClient{}},
			operator.InformerOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "*app.gatedInformer", reflect.TypeOf(inf).String())
	})

	t.Run("does not gate non-plugin informers", func(t *testing.T) {
		gate := mockReadinessGate{ready: make(chan struct{})}

		inf, err := childReconcilerInformerSupplier(nil, gate)(
			pluginsv0alpha1.MetaKind(),
			fakeClientGenerator{client: fakeResourceClient{}},
			operator.InformerOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "*operator.ConcurrentInformer", reflect.TypeOf(inf).String())
	})
}

func TestGatedInformer_RunWaitsForReady(t *testing.T) {
	ready := make(chan struct{})
	ran := make(chan struct{})
	inf := &gatedInformer{
		Informer: testInformer{runFunc: func(ctx context.Context) error {
			close(ran)
			<-ctx.Done()
			return nil
		}},
		gate: mockReadinessGate{ready: ready},
	}

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	done := make(chan error, 1)
	go func() {
		done <- inf.Run(ctx)
	}()

	select {
	case <-ran:
		t.Fatal("underlying informer ran before readiness gate opened")
	case <-time.After(20 * time.Millisecond):
	}

	close(ready)

	select {
	case <-ran:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("underlying informer did not run after readiness gate opened")
	}

	cancel()
	require.NoError(t, <-done)
}

func nestedInformerStoreType(t *testing.T, inf operator.Informer) string {
	t.Helper()

	concurrent, ok := inf.(*operator.ConcurrentInformer)
	require.True(t, ok)

	concurrentValue := reflect.ValueOf(concurrent).Elem()
	nestedInformer := concurrentValue.FieldByName("informer")
	require.True(t, nestedInformer.IsValid())

	customInformer := nestedInformer
	for customInformer.Kind() == reflect.Interface || customInformer.Kind() == reflect.Pointer {
		require.False(t, customInformer.IsNil())
		customInformer = customInformer.Elem()
	}
	store := customInformer.FieldByName("store")
	require.True(t, store.IsValid())
	require.False(t, store.IsNil())

	return store.Elem().Type().String()
}

type mockReadinessGate struct {
	ready chan struct{}
}

func (m mockReadinessGate) WaitUntilReady(ctx context.Context) error {
	select {
	case <-m.ready:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (mockReadinessGate) OwnsPlugin(context.Context, *pluginsv0alpha1.Plugin) (bool, error) {
	return true, nil
}

type testInformer struct {
	runFunc func(context.Context) error
}

func (t testInformer) Run(ctx context.Context) error {
	if t.runFunc != nil {
		return t.runFunc(ctx)
	}
	return nil
}

func (testInformer) WaitForSync(context.Context) error {
	return nil
}

func (testInformer) AddEventHandler(operator.ResourceWatcher) error {
	return nil
}

type fakeClientGenerator struct {
	client resource.Client
}

func (f fakeClientGenerator) ClientFor(resource.Kind) (resource.Client, error) {
	return f.client, nil
}

func (f fakeClientGenerator) GetCustomRouteClient(schema.GroupVersion, string) (resource.CustomRouteClient, error) {
	return nil, nil
}

type fakeResourceClient struct{}

func (fakeResourceClient) Get(context.Context, resource.Identifier) (resource.Object, error) {
	return nil, nil
}

func (fakeResourceClient) GetInto(context.Context, resource.Identifier, resource.Object) error {
	return nil
}

func (fakeResourceClient) Create(context.Context, resource.Identifier, resource.Object, resource.CreateOptions) (resource.Object, error) {
	return nil, nil
}

func (fakeResourceClient) CreateInto(context.Context, resource.Identifier, resource.Object, resource.CreateOptions, resource.Object) error {
	return nil
}

func (fakeResourceClient) Update(context.Context, resource.Identifier, resource.Object, resource.UpdateOptions) (resource.Object, error) {
	return nil, nil
}

func (fakeResourceClient) UpdateInto(context.Context, resource.Identifier, resource.Object, resource.UpdateOptions, resource.Object) error {
	return nil
}

func (fakeResourceClient) Patch(context.Context, resource.Identifier, resource.PatchRequest, resource.PatchOptions) (resource.Object, error) {
	return nil, nil
}

func (fakeResourceClient) PatchInto(context.Context, resource.Identifier, resource.PatchRequest, resource.PatchOptions, resource.Object) error {
	return nil
}

func (fakeResourceClient) Delete(context.Context, resource.Identifier, resource.DeleteOptions) error {
	return nil
}

func (fakeResourceClient) List(context.Context, string, resource.ListOptions) (resource.ListObject, error) {
	return nil, nil
}

func (fakeResourceClient) ListInto(context.Context, string, resource.ListOptions, resource.ListObject) error {
	return nil
}

func (fakeResourceClient) Watch(context.Context, string, resource.WatchOptions) (resource.WatchResponse, error) {
	return nil, nil
}

func (fakeResourceClient) SubresourceRequest(context.Context, resource.Identifier, resource.CustomRouteRequestOptions) ([]byte, error) {
	return nil, nil
}
