package apistore_test

import (
	"encoding/json"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/apitesting"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	examplev1 "k8s.io/apiserver/pkg/apis/example/v1"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	storagetesting "github.com/grafana/grafana/pkg/apiserver/storage/testing"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	sharedGroup    = "example.grafana.app"
	sharedLabelKey = "example.grafana.app/group"
	sharedNS       = "default"
	sharedResource = "things"
)

func TestSharedStorage(t *testing.T) {
	ctx := storagetesting.NewContext()
	client := newSharedTestClient(t)
	storeA := newSharedTestStorage(t, client, "a")
	storeB := newSharedTestStorage(t, client, "b")

	out := &unstructured.Unstructured{}
	require.NoError(t, storeA.Create(ctx, sharedKey("a", "one"), sharedThing("a", "one"), out, 0))
	require.Equal(t, "a."+sharedGroup+"/v1", out.GetAPIVersion())
	require.NotContains(t, out.GetLabels(), sharedLabelKey)

	t.Run("persists the shared group and label", func(t *testing.T) {
		rsp, err := client.Read(ctx, &resourcepb.ReadRequest{Key: &resourcepb.ResourceKey{
			Namespace: sharedNS, Group: sharedGroup, Resource: sharedResource, Name: "one",
		}})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		stored := &unstructured.Unstructured{}
		require.NoError(t, json.Unmarshal(rsp.Value, stored))
		require.Equal(t, sharedGroup+"/v1", stored.GetAPIVersion())
		require.Equal(t, "a", stored.GetLabels()[sharedLabelKey])
		require.Equal(t, "kept", stored.GetLabels()["user"])
	})

	t.Run("get restores the served group", func(t *testing.T) {
		got := &unstructured.Unstructured{}
		require.NoError(t, storeA.Get(ctx, sharedKey("a", "one"), storage.GetOptions{}, got))
		require.Equal(t, "a."+sharedGroup+"/v1", got.GetAPIVersion())
		require.Equal(t, map[string]string{"user": "kept"}, got.GetLabels())
	})

	t.Run("other groups cannot see the object", func(t *testing.T) {
		err := storeB.Get(ctx, sharedKey("b", "one"), storage.GetOptions{}, &unstructured.Unstructured{})
		require.True(t, storage.IsNotFound(err), "got %v", err)

		err = storeB.Get(ctx, sharedKey("b", "one"), storage.GetOptions{IgnoreNotFound: true}, &unstructured.Unstructured{})
		require.NoError(t, err)

		err = storeB.Delete(ctx, sharedKey("b", "one"), &unstructured.Unstructured{}, nil, nil, nil, storage.DeleteOptions{})
		require.True(t, storage.IsNotFound(err), "got %v", err)

		err = storeB.GuaranteedUpdate(ctx, sharedKey("b", "one"), &unstructured.Unstructured{}, false, nil,
			func(input runtime.Object, _ storage.ResponseMeta) (runtime.Object, *uint64, error) {
				return input, nil, nil
			}, nil)
		require.True(t, apierrors.IsNotFound(err), "got %v", err)

		// The name is shared across groups
		err = storeB.Create(ctx, sharedKey("b", "one"), sharedThing("b", "one"), &unstructured.Unstructured{}, 0)
		require.True(t, storage.IsExist(err), "got %v", err)
	})

	require.NoError(t, storeB.Create(ctx, sharedKey("b", "two"), sharedThing("b", "two"), &unstructured.Unstructured{}, 0))

	t.Run("list only returns the served group", func(t *testing.T) {
		require.Equal(t, []string{"one"}, sharedListNames(t, storeA, "a"))
		require.Equal(t, []string{"two"}, sharedListNames(t, storeB, "b"))
	})

	t.Run("update keeps the served group", func(t *testing.T) {
		updated := &unstructured.Unstructured{}
		err := storeA.GuaranteedUpdate(ctx, sharedKey("a", "one"), updated, false, nil,
			func(input runtime.Object, _ storage.ResponseMeta) (runtime.Object, *uint64, error) {
				obj := input.(*unstructured.Unstructured)
				obj.Object["spec"] = map[string]any{"value": "changed"}
				return obj, nil, nil
			}, nil)
		require.NoError(t, err)
		require.Equal(t, "a."+sharedGroup+"/v1", updated.GetAPIVersion())
		require.Equal(t, []string{"one"}, sharedListNames(t, storeA, "a"))
	})

	t.Run("watch only returns the served group", func(t *testing.T) {
		list := &unstructured.UnstructuredList{}
		require.NoError(t, storeA.GetList(ctx, sharedKey("a", ""), sharedListOptions(), list))

		opts := sharedListOptions()
		opts.ResourceVersion = list.GetResourceVersion()
		w, err := storeA.Watch(ctx, sharedKey("a", ""), opts)
		require.NoError(t, err)
		defer w.Stop()

		require.NoError(t, storeB.Create(ctx, sharedKey("b", "three"), sharedThing("b", "three"), &unstructured.Unstructured{}, 0))
		require.NoError(t, storeA.Create(ctx, sharedKey("a", "four"), sharedThing("a", "four"), &unstructured.Unstructured{}, 0))

		select {
		case evt := <-w.ResultChan():
			require.Equal(t, watch.Added, evt.Type)
			obj, err := meta.Accessor(evt.Object)
			require.NoError(t, err)
			require.Equal(t, "four", obj.GetName())
			require.Equal(t, "a."+sharedGroup+"/v1", evt.Object.GetObjectKind().GroupVersionKind().GroupVersion().String())
		case <-time.After(5 * time.Second):
			t.Fatal("timed out waiting for watch event")
		}
	})
}

func newSharedTestClient(t *testing.T) resource.ResourceClient {
	t.Helper()
	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	backend, err := resource.NewKVStorageBackend(resource.KVBackendOptions{
		KvStore:      resource.NewBadgerKV(db),
		WatchOptions: resource.WatchOptions{SettleDelay: time.Millisecond},
	})
	require.NoError(t, err)
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{Backend: backend})
	require.NoError(t, err)
	return resource.NewLocalResourceClient(server)
}

func newSharedTestStorage(t *testing.T, client resource.ResourceClient, prefix string) storage.Interface {
	t.Helper()
	gr := schema.GroupResource{Group: prefix + "." + sharedGroup, Resource: sharedResource}
	config := storagebackend.NewDefaultConfig("", apitesting.TestCodec(codecs, examplev1.SchemeGroupVersion))
	store, destroy, err := apistore.NewStorage(
		config.ForResource(gr),
		client,
		func(obj runtime.Object) (string, error) {
			accessor, err := meta.Accessor(obj)
			if err != nil {
				return "", err
			}
			return sharedKey(prefix, accessor.GetName()), nil
		},
		nil,
		func() runtime.Object { return &unstructured.Unstructured{} },
		func() runtime.Object { return &unstructured.UnstructuredList{} },
		storage.DefaultNamespaceScopedAttr,
		make(map[string]storage.IndexerFunc),
		nil, nil,
		apistore.StorageOptions{
			Serializer: apistore.JSONSerializer(),
			SharedStorage: &apistore.SharedStorage{
				Group:      sharedGroup,
				LabelKey:   sharedLabelKey,
				LabelValue: prefix,
			},
		},
	)
	require.NoError(t, err)
	t.Cleanup(destroy)
	return store
}

func sharedKey(prefix, name string) string {
	return (&grafanaregistry.Key{
		Group:     prefix + "." + sharedGroup,
		Resource:  sharedResource,
		Namespace: sharedNS,
		Name:      name,
	}).String()
}

func sharedThing(prefix, name string) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{"value": name},
	}}
	obj.SetAPIVersion(prefix + "." + sharedGroup + "/v1")
	obj.SetKind("Thing")
	obj.SetNamespace(sharedNS)
	obj.SetName(name)
	obj.SetLabels(map[string]string{"user": "kept"})
	return obj
}

func sharedListOptions() storage.ListOptions {
	return storage.ListOptions{Predicate: storage.Everything, Recursive: true}
}

func sharedListNames(t *testing.T, store storage.Interface, prefix string) []string {
	t.Helper()
	list := &unstructured.UnstructuredList{}
	require.NoError(t, store.GetList(storagetesting.NewContext(), sharedKey(prefix, ""), sharedListOptions(), list))
	names := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		names = append(names, item.GetName())
	}
	return names
}
