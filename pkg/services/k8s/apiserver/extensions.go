package apiserver

import (
	"fmt"
	"net/url"
	"reflect"

	oteltrace "go.opentelemetry.io/otel/trace"

	v1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1beta1"
	apiextensionsapiserver "k8s.io/apiextensions-apiserver/pkg/apiserver"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/features"
	genericregistry "k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"

	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/apiserver/pkg/util/proxy"
	"k8s.io/apiserver/pkg/util/webhook"
	clientgoinformers "k8s.io/client-go/informers"
	corev1 "k8s.io/client-go/listers/core/v1"
)

func (s *service) extensionsServerConfig(sharedInformerFactory clientgoinformers.SharedInformerFactory, apiEnablement *options.APIEnablementOptions, originalEtcd *options.EtcdOptions, apiServerConfig *genericapiserver.Config) (*apiextensionsapiserver.Config, error) {
	serverConfig := *apiServerConfig
	serverConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}
	serverConfig.RESTOptionsGetter = nil

	// copy the etcd options so we don't mutate originals.
	// we assume that the etcd options have been completed already.  avoid messing with anything outside
	// of changes to StorageConfig as that may lead to unexpected behavior when the options are applied.
	etcdOptions := *originalEtcd
	etcdOptions.StorageConfig.Paging = utilfeature.DefaultFeatureGate.Enabled(features.APIListChunking)
	// this is where the true decodable levels come from.
	etcdOptions.StorageConfig.Codec = apiextensionsapiserver.Codecs.LegacyCodec(v1beta1.SchemeGroupVersion, v1.SchemeGroupVersion)
	// prefer the more compact serialization (v1beta1) for storage until https://issue.k8s.io/82292 is resolved for objects whose v1 serialization is too big but whose v1beta1 serialization can be stored
	etcdOptions.StorageConfig.EncodeVersioner = runtime.NewMultiGroupVersioner(v1beta1.SchemeGroupVersion, schema.GroupKind{Group: v1beta1.GroupName})
	etcdOptions.SkipHealthEndpoints = true // avoid double wiring of health checks
	if err := etcdOptions.ApplyTo(&serverConfig); err != nil {
		return nil, err
	}

	if err := apiEnablement.ApplyTo(&serverConfig, apiextensionsapiserver.DefaultAPIResourceConfigSource(), apiextensionsapiserver.Scheme); err != nil {
		return nil, err
	}
	crdRESTOptionsGetter, err := NewCRDRESTOptionsGetter(etcdOptions)
	if err != nil {
		return nil, err
	}

	config := &apiextensionsapiserver.Config{
		GenericConfig: &genericapiserver.RecommendedConfig{
			Config:                serverConfig,
			SharedInformerFactory: sharedInformerFactory,
		},
		ExtraConfig: apiextensionsapiserver.ExtraConfig{
			CRDRESTOptionsGetter: crdRESTOptionsGetter,
			MasterCount:          1,
			ServiceResolver:      &serviceResolver{sharedInformerFactory.Core().V1().Services().Lister()},
			AuthResolverWrapper:  webhook.NewDefaultAuthenticationInfoResolverWrapper(nil, nil, serverConfig.LoopbackClientConfig, oteltrace.NewNoopTracerProvider()),
		},
	}
	config.GenericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}
	return config, nil
}

func NewCRDRESTOptionsGetter(etcdOptions options.EtcdOptions) (genericregistry.RESTOptionsGetter, error) {
	etcdOptions.StorageConfig.Codec = unstructured.UnstructuredJSONScheme
	etcdOptions.WatchCacheSizes = nil      // this control is not provided for custom resources
	etcdOptions.SkipHealthEndpoints = true // avoid double wiring of health checks

	// creates a generic apiserver config for etcdOptions to mutate
	c := genericapiserver.Config{}
	if err := etcdOptions.ApplyTo(&c); err != nil {
		return nil, err
	}
	restOptionsGetter := c.RESTOptionsGetter
	if restOptionsGetter == nil {
		return nil, fmt.Errorf("server.Config RESTOptionsGetter should not be nil")
	}
	// sanity check that no other fields are set
	c.RESTOptionsGetter = nil
	if !reflect.DeepEqual(c, genericapiserver.Config{}) {
		return nil, fmt.Errorf("only RESTOptionsGetter should have been mutated in server.Config")
	}
	return restOptionsGetter, nil
}

type serviceResolver struct {
	services corev1.ServiceLister
}

func (r *serviceResolver) ResolveEndpoint(namespace, name string, port int32) (*url.URL, error) {
	return proxy.ResolveCluster(r.services, namespace, name, port)
}
