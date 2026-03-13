package apistore_test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"k8s.io/apimachinery/pkg/api/apitesting"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/apis/example"
	examplev1 "k8s.io/apiserver/pkg/apis/example/v1"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	storagetesting "github.com/grafana/grafana/pkg/apiserver/storage/testing"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var scheme = runtime.NewScheme()
var codecs = serializer.NewCodecFactory(scheme)

func testSetup(t testing.TB) (context.Context, storage.Interface, factory.DestroyFunc, error) {
	t.Helper()

	ctx := storagetesting.NewContext()
	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	if err != nil {
		return nil, nil, nil, err
	}

	backend, err := resource.NewKVStorageBackend(resource.KVBackendOptions{
		KvStore: resource.NewBadgerKV(db),
		WatchOptions: resource.WatchOptions{
			SettleDelay: time.Millisecond,
		},
	})
	if err != nil {
		return nil, nil, nil, err
	}

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: backend,
	})
	if err != nil {
		return nil, nil, nil, err
	}
	_, err = server.IsHealthy(ctx, &resourcepb.HealthCheckRequest{}) //nolint:staticcheck
	if err != nil {
		return nil, nil, nil, err
	}

	client := resource.NewLocalResourceClient(server)
	config := storagebackend.NewDefaultConfig(t.TempDir(), apitesting.TestCodec(codecs, examplev1.SchemeGroupVersion))
	store, destroyStore, err := apistore.NewStorage(
		config.ForResource(schema.GroupResource{
			Group:    "example.apiserver.k8s.io",
			Resource: "pods",
		}),
		client,
		func(obj runtime.Object) (string, error) {
			accessor, err := meta.Accessor(obj)
			if err != nil {
				return "", err
			}
			return storagetesting.KeyFunc(accessor.GetNamespace(), accessor.GetName()), nil
		},
		testKeyParser,
		newPod,
		newPodList,
		storage.DefaultNamespaceScopedAttr,
		make(map[string]storage.IndexerFunc),
		nil,
		nil,
		apistore.StorageOptions{},
	)
	if err != nil {
		return nil, nil, nil, err
	}

	return ctx, store, destroyStore, nil
}

func newPod() runtime.Object {
	return &example.Pod{}
}

func newPodList() runtime.Object {
	return &example.PodList{}
}

func testKeyParser(val string) (*resourcepb.ResourceKey, error) {
	k, err := grafanaregistry.ParseKey(val)
	if err != nil {
		if strings.HasPrefix(val, "pods/") {
			parts := strings.Split(val, "/")
			if len(parts) == 2 {
				err = nil
				k = &grafanaregistry.Key{
					Resource: parts[0],
					Name:     parts[1],
				}
			} else if len(parts) == 3 {
				err = nil
				k = &grafanaregistry.Key{
					Resource:  parts[0],
					Namespace: parts[1],
					Name:      parts[2],
				}
			}
		}
	}
	if err != nil {
		return nil, err
	}
	if k.Group == "" {
		k.Group = "example.apiserver.k8s.io"
	}
	if k.Resource == "" {
		return nil, apierrors.NewInternalError(fmt.Errorf("missing resource in request"))
	}
	return &resourcepb.ResourceKey{
		Namespace: k.Namespace,
		Group:     k.Group,
		Resource:  k.Resource,
		Name:      k.Name,
	}, nil
}
