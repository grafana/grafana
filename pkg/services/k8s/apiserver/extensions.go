package apiserver

import (
	"fmt"
	"net/url"
	"reflect"

	oteltrace "go.opentelemetry.io/otel/trace"

	"k8s.io/apiextensions-apiserver/pkg/apiserver"
	apiextensionsapiserver "k8s.io/apiextensions-apiserver/pkg/apiserver"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	genericregistry "k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	genericoptions "k8s.io/apiserver/pkg/server/options"

	"k8s.io/apiserver/pkg/util/proxy"
	"k8s.io/apiserver/pkg/util/webhook"
	clientgoinformers "k8s.io/client-go/informers"
	corev1 "k8s.io/client-go/listers/core/v1"
)

func (s *service) extensionsServerConfig(sharedInformerFactory clientgoinformers.SharedInformerFactory, etdOptions *genericoptions.EtcdOptions, apiServerConfig *genericapiserver.Config) (*apiextensionsapiserver.Config, error) {
	APIEnablement := options.NewAPIEnablementOptions()
	serverConfig := *apiServerConfig
	serverConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}
	serverConfig.RESTOptionsGetter = nil

	if err := APIEnablement.ApplyTo(&serverConfig, apiextensionsapiserver.DefaultAPIResourceConfigSource(), apiextensionsapiserver.Scheme); err != nil {
		return nil, err
	}
	crdRESTOptionsGetter, err := NewCRDRESTOptionsGetter(*etdOptions)
	if err != nil {
		return nil, err
	}

	config := &apiserver.Config{
		GenericConfig: &genericapiserver.RecommendedConfig{
			Config:                serverConfig,
			SharedInformerFactory: sharedInformerFactory,
		},
		ExtraConfig: apiserver.ExtraConfig{
			CRDRESTOptionsGetter: crdRESTOptionsGetter,
			MasterCount:          1,
			ServiceResolver:      &serviceResolver{sharedInformerFactory.Core().V1().Services().Lister()},
			AuthResolverWrapper:  webhook.NewDefaultAuthenticationInfoResolverWrapper(nil, nil, serverConfig.LoopbackClientConfig, oteltrace.NewNoopTracerProvider()),
		},
	}
	return config, nil
}

func NewCRDRESTOptionsGetter(etcdOptions genericoptions.EtcdOptions) (genericregistry.RESTOptionsGetter, error) {
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
