// SPDX-License-Identifier: AGPL-3.0-only

package apistore

import (
	"os"
	"path/filepath"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	flowcontrolrequest "k8s.io/apiserver/pkg/util/flowcontrol/request"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/log"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/apiserver/versionpolicy"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ generic.RESTOptionsGetter = (*RESTOptionsGetter)(nil)
	_ StorageOptionsGetter      = (*RESTOptionsGetter)(nil)
	_ generic.RESTOptionsGetter = (*resourceOptionsGetter)(nil)
)

type StorageOptionsRegister func(gr schema.GroupResource, opts StorageOptions)

// StorageOptionsGetter is a RESTOptionsGetter whose storage options can be
// resolved by the caller rather than looked up by GroupResource.
//
// It exists because generic.RESTOptionsGetter only passes a GroupResource, and
// the runtime.Object it passes alongside is a zero object with no TypeMeta for
// typed kinds -- so by the time the getter is asked, the version is gone. Every
// store is built per group+version+resource though, and the getter is a value
// the builder hands to that one CompleteWithOptions call, so options that ride
// along with the getter can differ across versions of one resource.
type StorageOptionsGetter interface {
	generic.RESTOptionsGetter

	// WithStorageOptions returns a getter that builds storage with opts for the
	// single resource the caller is about to complete. Anything registered for
	// that resource by [RESTOptionsGetter.RegisterOptions] is ignored.
	WithStorageOptions(opts StorageOptions) generic.RESTOptionsGetter
}

func (r *RESTOptionsGetter) WithStorageOptions(opts StorageOptions) generic.RESTOptionsGetter {
	return &resourceOptionsGetter{parent: r, opts: opts}
}

// resourceOptionsGetter serves one store's RESTOptions from options its caller
// already resolved. Everything else -- client, codecs, secrets, version policy
// -- stays on the parent, which is shared across the whole server.
type resourceOptionsGetter struct {
	parent *RESTOptionsGetter
	opts   StorageOptions
}

func (g *resourceOptionsGetter) GetRESTOptions(resource schema.GroupResource, _ runtime.Object) (generic.RESTOptions, error) {
	return g.parent.restOptions(resource, g.opts)
}

type RESTOptionsGetter struct {
	client         resource.ResourceClient
	secrets        secret.InlineSecureValueSupport
	original       storagebackend.Config
	configProvider RestConfigProvider

	// Each group+resource may need custom options
	options map[string]StorageOptions

	// versionPolicy is shared across every resource this getter serves; nil disables maxAllowedVersion enforcement.
	versionPolicy *versionpolicy.VersionPolicyRegistry
}

// VersionPolicy returns the registry this getter enforces against; nil when enforcement is disabled.
// A getter that wraps this one and replaces the RESTOptions decorator has to copy this onto the
// StorageOptions it builds, or the resources it serves skip the cap.
func (r *RESTOptionsGetter) VersionPolicy() *versionpolicy.VersionPolicyRegistry {
	return r.versionPolicy
}

func NewRESTOptionsGetterForClient(
	client resource.ResourceClient,
	secrets secret.InlineSecureValueSupport,
	original storagebackend.Config,
	configProvider RestConfigProvider,
	versionPolicy *versionpolicy.VersionPolicyRegistry,
) *RESTOptionsGetter {
	return &RESTOptionsGetter{
		client:         client,
		secrets:        secrets,
		original:       original,
		options:        make(map[string]StorageOptions),
		configProvider: configProvider,
		versionPolicy:  versionPolicy,
	}
}

func NewRESTOptionsGetterMemory(originalStorageConfig storagebackend.Config, secrets secret.InlineSecureValueSupport) (*RESTOptionsGetter, error) {
	// Create BadgerDB with in-memory mode
	db, err := badger.Open(badger.DefaultOptions("").
		WithInMemory(true).
		WithMemTableSize(256 << 10).  // 256KB memtable size
		WithValueThreshold(16 << 10). // 16KB threshold for storing values in LSM vs value log
		WithNumMemtables(2).          // Keep only 2 memtables in memory
		WithLogger(nil))
	if err != nil {
		return nil, err
	}

	kv := resource.NewBadgerKV(db)
	backend, err := resource.NewKVStorageBackend(resource.KVBackendOptions{
		KvStore:                kv,
		Log:                    log.New(),
		DisableStorageServices: true,
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

	db, err := badger.Open(badger.DefaultOptions(filepath.Join(path, "badger")).
		WithLogger(nil))
	if err != nil {
		return nil, err
	}

	kv := resource.NewBadgerKV(db)
	backend, err := resource.NewKVStorageBackend(resource.KVBackendOptions{
		KvStore: kv,
		Log:     log.New(),
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
		nil,
	), nil
}

// RegisterOptions declares a resource's storage options for every version that
// serves it. Prefer [RESTOptionsGetter.WithStorageOptions] when versions of one
// resource need to differ -- see [StorageOptionsGetter].
func (r *RESTOptionsGetter) RegisterOptions(gr schema.GroupResource, opts StorageOptions) {
	r.options[gr.String()] = opts
}

// TODO: The RESTOptionsGetter interface added a new example object parameter to help determine the default
// storage version for a resource. This is not currently used in this implementation.
func (r *RESTOptionsGetter) GetRESTOptions(resource schema.GroupResource, _ runtime.Object) (generic.RESTOptions, error) {
	return r.restOptions(resource, r.options[resource.String()])
}

// restOptions builds a resource's RESTOptions around an already resolved set of
// StorageOptions, whether they came from the by-GroupResource map or from a
// caller that knows the version. SecureValues and VersionPolicy are filled in
// here so neither path can omit them.
func (r *RESTOptionsGetter) restOptions(resource schema.GroupResource, opts StorageOptions) (generic.RESTOptions, error) {
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
			opts.SecureValues = r.secrets
			opts.VersionPolicy = r.versionPolicy
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
