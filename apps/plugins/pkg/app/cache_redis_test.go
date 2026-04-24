package app

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

func TestRedisStore_SharesGlobalIndexAcrossInstances(t *testing.T) {
	server, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(server.Close)

	clientA := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = clientA.Close() })
	clientB := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = clientB.Close() })

	storeA, err := NewRedisStore(pluginsv0alpha1.PluginKind(), RedisCacheConfig{
		Client:       clientA,
		Prefix:       "test-shared",
		IndexBuckets: 8,
		ScanCount:    4,
		GetBatchSize: 2,
	})
	require.NoError(t, err)
	storeB, err := NewRedisStore(pluginsv0alpha1.PluginKind(), RedisCacheConfig{
		Client:       clientB,
		Prefix:       "test-shared",
		IndexBuckets: 8,
		ScanCount:    4,
		GetBatchSize: 2,
	})
	require.NoError(t, err)

	pluginA := testPlugin("default", "plugin-a")
	pluginB := testPlugin("default", "plugin-b")

	require.NoError(t, storeA.Add(pluginA))
	require.NoError(t, storeA.Add(pluginB))

	require.ElementsMatch(t, []string{"default/plugin-a", "default/plugin-b"}, storeB.ListKeys())

	got, exists, err := storeB.GetByKey("default/plugin-a")
	require.NoError(t, err)
	require.True(t, exists)
	require.Equal(t, pluginA.Name, got.(*pluginsv0alpha1.Plugin).Name)

	items := storeB.List()
	require.Len(t, items, 2)
}

func TestRedisStore_RemovesStaleKeysOnRead(t *testing.T) {
	server, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(server.Close)

	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	store, err := NewRedisStore(pluginsv0alpha1.PluginKind(), RedisCacheConfig{
		Client:       client,
		Prefix:       "test-stale",
		IndexBuckets: 8,
	})
	require.NoError(t, err)

	plugin := testPlugin("default", "plugin-a")
	require.NoError(t, store.Add(plugin))

	key := "default/plugin-a"
	bucket := store.bucketFor(key)

	require.NoError(t, client.Del(t.Context(), store.objectKey(key)).Err())
	members, err := client.SMembers(t.Context(), store.indexKeyForBucket(bucket)).Result()
	require.NoError(t, err)
	require.Contains(t, members, key)

	got, exists, err := store.GetByKey(key)
	require.NoError(t, err)
	require.False(t, exists)
	require.Nil(t, got)

	members, err = client.SMembers(t.Context(), store.indexKeyForBucket(bucket)).Result()
	require.NoError(t, err)
	require.NotContains(t, members, key)
}

func TestRedisStore_UsesConfiguredContext(t *testing.T) {
	server, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(server.Close)

	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	ctx, cancel := context.WithCancel(t.Context())
	store, err := NewRedisStore(pluginsv0alpha1.PluginKind(), RedisCacheConfig{
		Context: ctx,
		Client:  client,
		Prefix:  "test-context",
	})
	require.NoError(t, err)

	cancel()

	err = store.Add(testPlugin("default", "plugin-a"))
	require.ErrorIs(t, err, context.Canceled)
}

func TestRedisStore_UsesConfiguredContextWhenCalledByInformer(t *testing.T) {
	server, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(server.Close)

	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	storeCtx, cancelStore := context.WithCancel(t.Context())
	store, err := NewRedisStore(pluginsv0alpha1.PluginKind(), RedisCacheConfig{
		Context: storeCtx,
		Client:  client,
		Prefix:  "test-informer-context",
	})
	require.NoError(t, err)

	events := make(chan watch.Event, 1)
	t.Cleanup(func() { close(events) })

	watchStarted := sync.WaitGroup{}
	watchStarted.Add(1)

	informer := operator.NewCustomCacheInformer(
		store,
		&redisStoreTestListWatcher{
			listFunc: func(metav1.ListOptions) (runtime.Object, error) {
				return &pluginsv0alpha1.PluginList{}, nil
			},
			watchFunc: func(metav1.ListOptions) (watch.Interface, error) {
				watchStarted.Done()
				return &redisStoreTestWatch{events: events}, nil
			},
		},
		pluginsv0alpha1.PluginKind(),
		operator.CustomCacheInformerOptions{},
	)

	added := make(chan struct{}, 1)
	require.NoError(t, informer.AddEventHandler(&operator.SimpleWatcher{
		AddFunc: func(context.Context, resource.Object) error {
			added <- struct{}{}
			return nil
		},
	}))

	runCtx, cancelRun := context.WithCancel(t.Context())
	defer cancelRun()
	go func() { _ = informer.Run(runCtx) }()

	watchStarted.Wait()
	cancelStore()

	events <- watch.Event{
		Type:   watch.Added,
		Object: testPlugin("default", "plugin-a"),
	}

	select {
	case <-added:
		t.Fatal("expected canceled store context to prevent add handler dispatch")
	case <-time.After(100 * time.Millisecond):
	}

	got, exists, err := store.GetByKey("default/plugin-a")
	require.ErrorIs(t, err, context.Canceled)
	require.False(t, exists)
	require.Nil(t, got)
}

func testPlugin(namespace, name string) *pluginsv0alpha1.Plugin {
	return &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      name,
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:      name,
			Version: "1.0.0",
		},
	}
}

type redisStoreTestListWatcher struct {
	listFunc  func(metav1.ListOptions) (runtime.Object, error)
	watchFunc func(metav1.ListOptions) (watch.Interface, error)
}

func (lw *redisStoreTestListWatcher) List(options metav1.ListOptions) (runtime.Object, error) {
	return lw.listFunc(options)
}

func (lw *redisStoreTestListWatcher) Watch(options metav1.ListOptions) (watch.Interface, error) {
	return lw.watchFunc(options)
}

type redisStoreTestWatch struct {
	events chan watch.Event
}

func (w *redisStoreTestWatch) ResultChan() <-chan watch.Event {
	return w.events
}

func (*redisStoreTestWatch) Stop() {}
