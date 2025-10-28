// SPDX-License-Identifier: AGPL-3.0-only

package apistore

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"gocloud.dev/blob/fileblob"
	"gocloud.dev/blob/memblob"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	flowcontrolrequest "k8s.io/apiserver/pkg/util/flowcontrol/request"
	"k8s.io/client-go/tools/cache"

	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ generic.RESTOptionsGetter = (*RESTOptionsGetter)(nil)

type StorageOptionsRegister func(gr schema.GroupResource, opts StorageOptions)

type RESTOptionsGetter struct {
	client         resource.ResourceClient
	secrets        secret.InlineSecureValueSupport
	original       storagebackend.Config
	configProvider RestConfigProvider

	// Each group+resource may need custom options
	options map[string]StorageOptions
}

func NewRESTOptionsGetterForClient(
	client resource.ResourceClient,
	secrets secret.InlineSecureValueSupport,
	original storagebackend.Config,
	configProvider RestConfigProvider,
) *RESTOptionsGetter {
	return &RESTOptionsGetter{
		client:         client,
		secrets:        secrets,
		original:       original,
		options:        make(map[string]StorageOptions),
		configProvider: configProvider,
	}
}

func NewRESTOptionsGetterMemory(originalStorageConfig storagebackend.Config, secrets secret.InlineSecureValueSupport) (*RESTOptionsGetter, error) {
	backend, err := resource.NewCDKBackend(context.Background(), resource.CDKBackendOptions{
		Bucket: memblob.OpenBucket(&memblob.Options{}),
	})
	if err != nil {
		return nil, err
	}
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: backend,
	})
	if err != nil {
		return nil, err
	}
	return NewRESTOptionsGetterForClient(
		resource.NewLocalResourceClient(server),
		secrets,
		originalStorageConfig,
		nil,
	), nil
}

// Optionally, this constructor allows specifying directories
// for resources that are required to be read/watched on startup and there
// won't be any write operations that initially bootstrap their directories
func NewRESTOptionsGetterForFileXX(path string,
	originalStorageConfig storagebackend.Config,
	features map[string]any) (*RESTOptionsGetter, error) {
	if path == "" {
		path = filepath.Join(os.TempDir(), "grafana-apiserver")
	}

	bucket, err := fileblob.OpenBucket(filepath.Join(path, "resource"), &fileblob.Options{
		CreateDir: true,
		Metadata:  fileblob.MetadataDontWrite, // skip
	})
	if err != nil {
		return nil, err
	}
	backend, err := resource.NewCDKBackend(context.Background(), resource.CDKBackendOptions{
		Bucket: bucket,
	})
	if err != nil {
		return nil, err
	}
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: backend,
	})
	if err != nil {
		return nil, err
	}
	return NewRESTOptionsGetterForClient(
		resource.NewLocalResourceClient(server),
		nil, // secrets
		originalStorageConfig,
		nil,
	), nil
}

func (r *RESTOptionsGetter) RegisterOptions(gr schema.GroupResource, opts StorageOptions) {
	r.options[gr.String()] = opts
}

// TODO: The RESTOptionsGetter interface added a new example object parameter to help determine the default
// storage version for a resource. This is not currently used in this implementation.
func (r *RESTOptionsGetter) GetRESTOptions(resource schema.GroupResource, _ runtime.Object) (generic.RESTOptions, error) {
	storageConfig := &storagebackend.ConfigForResource{
		Config: storagebackend.Config{
			Type:                      "resource",
			Prefix:                    "resource/", // Not actually used
			Transport:                 storagebackend.TransportConfig{},
			Codec:                     r.original.Codec,
			EncodeVersioner:           r.original.EncodeVersioner,
			Transformer:               r.original.Transformer,
			CompactionInterval:        0,
			CountMetricPollPeriod:     0,
			DBMetricPollInterval:      0,
			HealthcheckTimeout:        0,
			ReadycheckTimeout:         0,
			StorageObjectCountTracker: flowcontrolrequest.NewStorageObjectCountTracker(),
		},
		GroupResource: resource,
	}

	ret := generic.RESTOptions{
		StorageConfig: storageConfig,
		Decorator: func(
			config *storagebackend.ConfigForResource,
			resourcePrefix string,
			keyFunc func(obj runtime.Object) (string, error),
			newFunc func() runtime.Object,
			newListFunc func() runtime.Object,
			getAttrsFunc storage.AttrFunc,
			trigger storage.IndexerFuncs,
			indexers *cache.Indexers,
		) (storage.Interface, factory.DestroyFunc, error) {
			opts := r.options[resource.String()]
			opts.SecureValues = r.secrets
			return NewStorage(config, r.client, keyFunc, nil, newFunc, newListFunc, getAttrsFunc,
				trigger, indexers, r.configProvider, opts)
		},
		DeleteCollectionWorkers: 0,
		EnableGarbageCollection: false,
		// k8s expects forward slashes here, we'll convert them to os path separators in the storage
		ResourcePrefix:            "/group/" + resource.Group + "/resource/" + resource.Resource,
		CountMetricPollPeriod:     1 * time.Second,
		StorageObjectCountTracker: storageConfig.StorageObjectCountTracker,
	}

	return ret, nil
}
