package appinstaller

import (
	"context"
	"errors"
	"path"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	"k8s.io/client-go/tools/cache"
)

// noopRESTOptionsGetter satisfies generic.RESTOptionsGetter for apps that do not need Unified Storage.
// Lets k8s complete store registration; NewStorage discards the stub in favour of the app's own storage.
type noopRESTOptionsGetter struct{}

var _ generic.RESTOptionsGetter = (*noopRESTOptionsGetter)(nil)

func (n *noopRESTOptionsGetter) GetRESTOptions(resource schema.GroupResource, _ runtime.Object) (generic.RESTOptions, error) {
	return generic.RESTOptions{
		StorageConfig: &storagebackend.ConfigForResource{
			Config:        storagebackend.Config{},
			GroupResource: resource,
		},
		Decorator: func(
			_ *storagebackend.ConfigForResource,
			_ string,
			_ func(obj runtime.Object) (string, error),
			_ func() runtime.Object,
			_ func() runtime.Object,
			_ storage.AttrFunc,
			_ storage.IndexerFuncs,
			_ *cache.Indexers,
		) (storage.Interface, factory.DestroyFunc, error) {
			return &noopStorage{}, func() {}, nil
		},
		ResourcePrefix:          path.Join("/noop", resource.Group, resource.Resource),
		DeleteCollectionWorkers: 0,
		EnableGarbageCollection: false,
		CountMetricPollPeriod:   0,
	}, nil
}

// noopStorage satisfies storage.Interface at registration time; never called at request time.
type noopStorage struct{}

var _ storage.Interface = (*noopStorage)(nil)

var errNoopStorage = errors.New("noop storage: not implemented")

func (n *noopStorage) Versioner() storage.Versioner                                { return &noopVersioner{} }
func (n *noopStorage) ReadinessCheck() error                                       { return nil }
func (n *noopStorage) RequestWatchProgress(_ context.Context) error                { return nil }
func (n *noopStorage) GetCurrentResourceVersion(_ context.Context) (uint64, error) { return 0, nil }
func (n *noopStorage) CompactRevision() int64                                      { return 0 }
func (n *noopStorage) Stats(_ context.Context) (storage.Stats, error)              { return storage.Stats{}, nil }
func (n *noopStorage) EnableResourceSizeEstimation(_ storage.KeysFunc) error       { return nil }

func (n *noopStorage) Create(_ context.Context, _ string, _, _ runtime.Object, _ uint64) error {
	return errNoopStorage
}

func (n *noopStorage) Delete(_ context.Context, _ string, _ runtime.Object, _ *storage.Preconditions, _ storage.ValidateObjectFunc, _ runtime.Object, _ storage.DeleteOptions) error {
	return errNoopStorage
}

func (n *noopStorage) Watch(_ context.Context, _ string, _ storage.ListOptions) (watch.Interface, error) {
	return nil, errNoopStorage
}

func (n *noopStorage) Get(_ context.Context, _ string, _ storage.GetOptions, _ runtime.Object) error {
	return errNoopStorage
}

func (n *noopStorage) GetList(_ context.Context, _ string, _ storage.ListOptions, _ runtime.Object) error {
	return errNoopStorage
}

func (n *noopStorage) GuaranteedUpdate(_ context.Context, _ string, _ runtime.Object, _ bool, _ *storage.Preconditions, _ storage.UpdateFunc, _ runtime.Object) error {
	return errNoopStorage
}

// noopVersioner satisfies storage.Versioner; all methods return errNoopStorage.
type noopVersioner struct{}

func (n *noopVersioner) UpdateObject(_ runtime.Object, _ uint64) error { return errNoopStorage }
func (n *noopVersioner) UpdateList(_ runtime.Object, _ uint64, _ string, _ *int64) error {
	return errNoopStorage
}
func (n *noopVersioner) PrepareObjectForStorage(_ runtime.Object) error { return errNoopStorage }
func (n *noopVersioner) ObjectResourceVersion(_ runtime.Object) (uint64, error) {
	return 0, errNoopStorage
}
func (n *noopVersioner) ParseResourceVersion(_ string) (uint64, error) { return 0, errNoopStorage }
