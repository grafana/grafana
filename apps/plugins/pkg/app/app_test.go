package app

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
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
		require.False(t, nestedMemcachedTrackKeys(t, inf))
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

func TestNoRetryPolicy(t *testing.T) {
	retry, after := noRetryPolicy(assertAnError{}, 1)
	require.False(t, retry)
	require.Zero(t, after)
}

func TestChildReconcilerRetryPolicy(t *testing.T) {
	t.Run("defaults to sdk controller policy", func(t *testing.T) {
		require.Nil(t, childReconcilerRetryPolicy(ChildReconcilerConfig{}))
	})

	t.Run("uses configured policy", func(t *testing.T) {
		custom := operator.ExponentialBackoffRetryPolicy(time.Second, 2)
		retry, after := childReconcilerRetryPolicy(ChildReconcilerConfig{RetryPolicy: custom})(assertAnError{}, 1)
		require.True(t, retry)
		require.Equal(t, 2*time.Second, after)
	})

	t.Run("can explicitly disable retries", func(t *testing.T) {
		retry, after := childReconcilerRetryPolicy(ChildReconcilerConfig{DisableRetries: true})(assertAnError{}, 1)
		require.False(t, retry)
		require.Zero(t, after)
	})
}

func TestChildReconcilerInformerOptions(t *testing.T) {
	opts := childReconcilerInformerOptions(&logging.NoOpLogger{}, ChildReconcilerConfig{})
	require.Zero(t, opts.CacheResyncInterval)
	require.EqualValues(t, 5, opts.MaxConcurrentWorkers)
	require.True(t, opts.UseWatchList)

	custom := childReconcilerInformerOptions(&logging.NoOpLogger{}, ChildReconcilerConfig{
		CacheResyncInterval:  time.Minute,
		MaxConcurrentWorkers: 9,
		UseWatchList: func() *bool {
			v := false
			return &v
		}(),
	})
	require.Equal(t, time.Minute, custom.CacheResyncInterval)
	require.EqualValues(t, 9, custom.MaxConcurrentWorkers)
	require.False(t, custom.UseWatchList)
}

func TestChildReconcilerErrorHandler(t *testing.T) {
	var sink bytes.Buffer
	logger := logging.NewSLogLogger(slog.NewTextHandler(&sink, &slog.HandlerOptions{Level: slog.LevelDebug}))
	handler := childReconcilerErrorHandler(logger)

	handler(context.Background(), &install.ChildPluginReconcilerError{
		Source:    install.ChildPluginReconcilerFailureSourceMetadataLookup,
		PluginID:  "test-plugin",
		Version:   "1.2.3",
		Namespace: "stacks-11",
		Err:       errors.New("not found"),
	})

	output := sink.String()
	require.Contains(t, output, "Child plugin reconciliation failed")
	require.Contains(t, output, "failureSource=metadata_lookup")
	require.Contains(t, output, "pluginId=test-plugin")
	require.Contains(t, output, "requestNamespace=stacks-11")
	require.Contains(t, output, "version=1.2.3")
	require.Contains(t, output, "error=\"not found\"")
}

func TestChildReconcilerErrorHandlerFallsBackToInformerError(t *testing.T) {
	var sink bytes.Buffer
	logger := logging.NewSLogLogger(slog.NewTextHandler(&sink, &slog.HandlerOptions{Level: slog.LevelDebug}))
	handler := childReconcilerErrorHandler(logger)

	handler(context.Background(), errors.New("watch closed"))

	output := sink.String()
	require.Contains(t, output, "Child plugin informer failed")
	require.Contains(t, output, "error=\"watch closed\"")
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

func nestedMemcachedTrackKeys(t *testing.T, inf operator.Informer) bool {
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

	memcachedStore := store
	for memcachedStore.Kind() == reflect.Interface || memcachedStore.Kind() == reflect.Pointer {
		require.False(t, memcachedStore.IsNil())
		memcachedStore = memcachedStore.Elem()
	}
	trackKeys := memcachedStore.FieldByName("trackKeys")
	require.True(t, trackKeys.IsValid())
	return trackKeys.Bool()
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

type assertAnError struct{}

func (assertAnError) Error() string {
	return "boom"
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
