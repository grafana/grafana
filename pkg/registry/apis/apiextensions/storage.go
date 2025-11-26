package apiextensions

import (
	"strings"

	apiextensionsinternal "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	genericregistry "k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// CRDRESTOptionsGetter wraps the Grafana unified storage RESTOptionsGetter
// to be compatible with the Kubernetes apiextensions-apiserver requirements.
type CRDRESTOptionsGetter struct {
	delegate      *apistore.RESTOptionsGetter
	unifiedClient resource.ResourceClient
	scheme        *runtime.Scheme
	codecs        serializer.CodecFactory
}

// NewCRDRESTOptionsGetter creates a new CRDRESTOptionsGetter
func NewCRDRESTOptionsGetter(
	delegate *apistore.RESTOptionsGetter,
	unifiedClient resource.ResourceClient,
) *CRDRESTOptionsGetter {
	scheme := runtime.NewScheme()
	_ = apiextensionsv1.AddToScheme(scheme)
	_ = apiextensionsinternal.AddToScheme(scheme)
	codecs := serializer.NewCodecFactory(scheme)

	return &CRDRESTOptionsGetter{
		delegate:      delegate,
		unifiedClient: unifiedClient,
		scheme:        scheme,
		codecs:        codecs,
	}
}

// GetRESTOptions returns REST options for a given resource.
func (r *CRDRESTOptionsGetter) GetRESTOptions(
	res schema.GroupResource,
	example runtime.Object,
) (genericregistry.RESTOptions, error) {
	r.delegate.RegisterOptions(res, apistore.StorageOptions{})

	opts, err := r.delegate.GetRESTOptions(res, example)
	if err != nil {
		return opts, err
	}

	// CRDs use apiextensions codec, Custom Resources use unstructured
	if res.Group == apiextensionsv1.SchemeGroupVersion.Group {
		opts.StorageConfig.Config.Codec = r.codecs.LegacyCodec(apiextensionsv1.SchemeGroupVersion)
	} else {
		opts.StorageConfig.Config.Codec = unstructured.UnstructuredJSONScheme
	}

	// CRDs are cluster-scoped, Custom Resources are typically namespace-scoped
	isClusterScoped := res.Group == apiextensionsv1.SchemeGroupVersion.Group

	opts.Decorator = func(
		config *storagebackend.ConfigForResource,
		resourcePrefix string,
		keyFunc func(obj runtime.Object) (string, error),
		newFunc func() runtime.Object,
		newListFunc func() runtime.Object,
		getAttrsFunc storage.AttrFunc,
		trigger storage.IndexerFuncs,
		indexers *cache.Indexers,
	) (storage.Interface, factory.DestroyFunc, error) {
		// Key parser that handles K8s apiextensions-apiserver key format
		// Keys are: /group/<group>/resource/<resource>[/<namespace>][/<name>]
		keyParser := makeKeyParser(config.GroupResource, isClusterScoped)

		return apistore.NewStorage(
			config,
			r.unifiedClient,
			keyFunc,
			keyParser,
			newFunc,
			newListFunc,
			getAttrsFunc,
			trigger,
			indexers,
			nil,
			apistore.StorageOptions{},
		)
	}

	return opts, nil
}

// makeKeyParser creates a key parser for the given resource.
// K8s apiextensions-apiserver generates keys in the format:
//   - Cluster-scoped: /group/<group>/resource/<resource>/<name>
//   - Namespace-scoped: /group/<group>/resource/<resource>/<namespace>/<name>
func makeKeyParser(gr schema.GroupResource, isClusterScoped bool) func(key string) (*resourcepb.ResourceKey, error) {
	return func(key string) (*resourcepb.ResourceKey, error) {
		// Key format: /group/<group>/resource/<resource>[/<extra1>][/<extra2>]
		// Strip prefix and parse
		parts := strings.Split(strings.TrimPrefix(key, "/"), "/")

		result := &resourcepb.ResourceKey{
			Group:    gr.Group,
			Resource: gr.Resource,
		}

		// Expected: ["group", "<group>", "resource", "<resource>", ...]
		// Skip the known prefix parts and extract namespace/name
		if len(parts) >= 4 {
			extra := parts[4:] // Parts after /group/X/resource/Y

			if isClusterScoped {
				// Cluster-scoped: extra is [name] or []
				if len(extra) >= 1 && extra[0] != "" {
					result.Name = extra[0]
				}
			} else {
				// Namespace-scoped: extra is [namespace] or [namespace, name]
				if len(extra) >= 1 && extra[0] != "" {
					result.Namespace = extra[0]
				}
				if len(extra) >= 2 && extra[1] != "" {
					result.Name = extra[1]
				}
			}
		}

		return result, nil
	}
}
