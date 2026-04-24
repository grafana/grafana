package app

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"reflect"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
)

func TestChildReconcilerInformerSupplier(t *testing.T) {
	t.Run("uses optimized informer by default", func(t *testing.T) {
		inf, err := childReconcilerInformerSupplier(ChildReconcilerConfig{})(
			pluginsv0alpha1.PluginKind(),
			fakeClientGenerator{client: fakeResourceClient{}},
			operator.InformerOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "*app.filteredPluginInformer", reflect.TypeOf(inf).String())
		require.Equal(t, "*cache.cache", nestedInformerStoreType(t, inf))
	})

	t.Run("uses redis informer when configured", func(t *testing.T) {
		server, err := miniredis.Run()
		require.NoError(t, err)
		t.Cleanup(server.Close)

		client := redis.NewClient(&redis.Options{Addr: server.Addr()})
		t.Cleanup(func() { _ = client.Close() })

		inf, err := childReconcilerInformerSupplier(ChildReconcilerConfig{
			RedisCache: RedisCacheConfig{Client: client},
		})(
			pluginsv0alpha1.PluginKind(),
			fakeClientGenerator{client: fakeResourceClient{}},
			operator.InformerOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "*app.filteredPluginInformer", reflect.TypeOf(inf).String())
		require.Equal(t, "*app.RedisStore", nestedInformerStoreType(t, inf))
	})

	t.Run("gates plugin informer when ownership filter exposes readiness", func(t *testing.T) {
		gate := mockReadinessGate{ready: make(chan struct{})}

		inf, err := childReconcilerInformerSupplier(ChildReconcilerConfig{OwnershipFilter: gate})(
			pluginsv0alpha1.PluginKind(),
			fakeClientGenerator{client: fakeResourceClient{}},
			operator.InformerOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "*app.gatedInformer", reflect.TypeOf(inf).String())
	})

	t.Run("does not gate non-plugin informers", func(t *testing.T) {
		gate := mockReadinessGate{ready: make(chan struct{})}

		inf, err := childReconcilerInformerSupplier(ChildReconcilerConfig{OwnershipFilter: gate})(
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

	handler(t.Context(), &install.ChildPluginReconcilerError{
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

	handler(t.Context(), errors.New("watch closed"))

	output := sink.String()
	require.Contains(t, output, "Child plugin informer failed")
	require.Contains(t, output, "error=\"watch closed\"")
}

func nestedInformerStoreType(t *testing.T, inf operator.Informer) string {
	t.Helper()

	concurrent, ok := unwrapConcurrentInformer(t, inf)
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

func unwrapConcurrentInformer(t *testing.T, inf operator.Informer) (*operator.ConcurrentInformer, bool) {
	t.Helper()

	current := reflect.ValueOf(inf)
	for {
		if !current.IsValid() {
			return nil, false
		}
		if current.Kind() == reflect.Interface || current.Kind() == reflect.Pointer {
			if current.IsNil() {
				return nil, false
			}
			if concurrent, ok := current.Interface().(*operator.ConcurrentInformer); ok {
				return concurrent, true
			}
			elem := current.Elem()
			if elem.Kind() != reflect.Struct {
				current = elem
				continue
			}
			informerField := elem.FieldByName("Informer")
			if informerField.IsValid() {
				current = informerField
				continue
			}
			return nil, false
		}
		return nil, false
	}
}

func TestFilteredPluginInformerSkipsNonAppPlugins(t *testing.T) {
	var wrapped operator.ResourceWatcher
	inf := &filteredPluginInformer{
		Informer: watcherCapturingInformer{
			addEventHandlerFunc: func(handler operator.ResourceWatcher) error {
				wrapped = handler
				return nil
			},
		},
	}

	appPlugin := &pluginsv0alpha1.Plugin{
		Spec: pluginsv0alpha1.PluginSpec{Id: "example-app"},
	}
	nonAppPlugin := &pluginsv0alpha1.Plugin{
		Spec: pluginsv0alpha1.PluginSpec{Id: "example-panel"},
	}

	var added []string
	err := inf.AddEventHandler(&operator.SimpleWatcher{
		AddFunc: func(ctx context.Context, object resource.Object) error {
			added = append(added, object.(*pluginsv0alpha1.Plugin).Spec.Id)
			return nil
		},
	})
	require.NoError(t, err)
	require.NotNil(t, wrapped)

	require.NoError(t, wrapped.Add(t.Context(), nonAppPlugin))
	require.NoError(t, wrapped.Add(t.Context(), appPlugin))
	require.Equal(t, []string{"example-app"}, added)
}

type watcherCapturingInformer struct {
	addEventHandlerFunc func(operator.ResourceWatcher) error
}

func (w watcherCapturingInformer) Run(context.Context) error {
	return nil
}

func (w watcherCapturingInformer) WaitForSync(context.Context) error {
	return nil
}

func (w watcherCapturingInformer) AddEventHandler(handler operator.ResourceWatcher) error {
	if w.addEventHandlerFunc != nil {
		return w.addEventHandlerFunc(handler)
	}
	return nil
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
