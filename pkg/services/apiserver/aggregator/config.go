package aggregator

import (
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"
	aggregatoropenapi "k8s.io/kube-aggregator/pkg/generated/openapi"
	"k8s.io/kube-openapi/pkg/common"

	serviceclientset "github.com/grafana/grafana/pkg/generated/clientset/versioned"
	informersv0alpha1 "github.com/grafana/grafana/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

type RemoteService struct {
	Group   string `yaml:"group"`
	Version string `yaml:"version"`
	Host    string `yaml:"host"`
	Port    int32  `yaml:"port"`
}

type RemoteServicesConfig struct {
	ExternalNamesNamespace string
	InsecureSkipTLSVerify  bool
	CABundle               []byte
	Services               []RemoteService
	serviceClientSet       *serviceclientset.Clientset
}

type CustomExtraConfig struct {
	DiscoveryOnlyProxyClientCertFile string
	DiscoveryOnlyProxyClientKeyFile  string
}

type Config struct {
	KubeAggregatorConfig *aggregatorapiserver.Config
	CustomExtraConfig    *CustomExtraConfig // this is temporary and will be removed once we have moved across newer auth rollout in cloud
	Informers            informersv0alpha1.SharedInformerFactory
	RemoteServicesConfig *RemoteServicesConfig
	// Builders contain prerequisite api groups for aggregator to function correctly e.g. ExternalName
	// Since the main APIServer delegate supports storage implementations that intend to be multi-tenant
	// Aggregator builders that we don't intend to use multi-tenant storage are kept in aggregator's
	// Delegate, one which is configured explicitly to use file storage only
	Builders []builder.APIGroupBuilder
}

// remoteServices may be nil when not using aggregation
func NewConfig(aggregator *aggregatorapiserver.Config, customExtraConfig *CustomExtraConfig, informers informersv0alpha1.SharedInformerFactory, builders []builder.APIGroupBuilder, remoteServices *RemoteServicesConfig) *Config {
	getMergedOpenAPIDefinitions := func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		aggregatorAPIs := aggregatoropenapi.GetOpenAPIDefinitions(ref)
		builderAPIs := builder.GetOpenAPIDefinitions(builders)(ref)

		for k, v := range builderAPIs {
			aggregatorAPIs[k] = v
		}

		return aggregatorAPIs
	}

	// Add OpenAPI config, which depends on builders
	namer := openapinamer.NewDefinitionNamer(aggregatorscheme.Scheme)
	aggregator.GenericConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(getMergedOpenAPIDefinitions, namer)
	aggregator.GenericConfig.OpenAPIV3Config.Info.Title = "Kubernetes"
	aggregator.GenericConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(getMergedOpenAPIDefinitions, namer)
	aggregator.GenericConfig.OpenAPIConfig.Info.Title = "Kubernetes"

	return &Config{
		aggregator,
		customExtraConfig,
		informers,
		remoteServices,
		builders,
	}
}
