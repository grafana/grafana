package server

import (
	"github.com/grafana/grafana-app-sdk/apiserver"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/version"
	"k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
)

// Config defines the config for the apiserver
type Config struct {
	*genericapiserver.RecommendedConfig

	ExtraConfig ExtraConfig
}

// ExtraConfig holds custom apiserver config
type ExtraConfig struct {
	ResourceGroups           []*apiserver.ResourceGroup
	Scheme                   *runtime.Scheme
	Codecs                   serializer.CodecFactory
	OpenAPIDefinitionGetters []common.GetOpenAPIDefinitions
}

func NewConfig(groups []*apiserver.ResourceGroup) *Config {
	scheme := runtime.NewScheme()
	codecs := serializer.NewCodecFactory(scheme)

	metav1.AddToGroupVersion(scheme, schema.GroupVersion{Version: "v1"})

	unversioned := schema.GroupVersion{Group: "", Version: "v1"}
	scheme.AddUnversionedTypes(unversioned,
		&metav1.Status{},
		&metav1.APIVersions{},
		&metav1.APIGroupList{},
		&metav1.APIGroup{},
		&metav1.APIResourceList{},
		&metav1.Status{},
		&metav1.WatchEvent{},
	)

	for _, g := range groups {
		g.AddToScheme(scheme)
	}

	return &Config{
		RecommendedConfig: genericapiserver.NewRecommendedConfig(codecs),
		ExtraConfig: ExtraConfig{
			ResourceGroups:           groups,
			Scheme:                   scheme,
			Codecs:                   codecs,
			OpenAPIDefinitionGetters: []common.GetOpenAPIDefinitions{},
		},
	}
}

// Complete fills in any fields not set that are required to have valid data. It's mutating the receiver.
func (cfg *Config) Complete() CompletedAPIServerConfig {
	c := completedConfig{
		cfg.RecommendedConfig.Complete(),
		&cfg.ExtraConfig,
	}

	c.CompletedConfig.Version = &version.Info{
		Major: "1",
		Minor: "0",
	}

	openapiGetters := c.ExtraConfig.OpenAPIDefinitionGetters
	for _, g := range c.ExtraConfig.ResourceGroups {
		for _, r := range g.Resources {
			openapiGetters = append(openapiGetters, r.GetOpenAPIDefinitions)
		}
	}

	c.CompletedConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(apiserver.GetOpenAPIDefinitions(openapiGetters), openapi.NewDefinitionNamer(c.ExtraConfig.Scheme))
	c.CompletedConfig.OpenAPIConfig.Info.Title = "grafana-apiserver"
	c.CompletedConfig.OpenAPIConfig.Info.Version = "1.0"

	c.CompletedConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(apiserver.GetOpenAPIDefinitions(openapiGetters), openapi.NewDefinitionNamer(c.ExtraConfig.Scheme))
	c.CompletedConfig.OpenAPIV3Config.Info.Title = "grafana-apiserver"
	c.CompletedConfig.OpenAPIV3Config.Info.Version = "1.0"

	return CompletedAPIServerConfig{&c}
}

type completedConfig struct {
	CompletedConfig genericapiserver.CompletedConfig
	ExtraConfig     *ExtraConfig
}

// CompletedAPIServerConfig embeds a private pointer that cannot be instantiated outside of this package.
type CompletedAPIServerConfig struct {
	*completedConfig
}

type Server struct {
	*genericapiserver.GenericAPIServer
}

func (c completedConfig) NewServer(delegate genericapiserver.DelegationTarget) (*Server, error) {
	scheme := c.ExtraConfig.Scheme
	codecs := c.ExtraConfig.Codecs

	genericServer, err := c.CompletedConfig.New("grafana-apiserver", delegate)
	if err != nil {
		return nil, err
	}

	s := &Server{
		GenericAPIServer: genericServer,
	}

	parameterCodec := runtime.NewParameterCodec(scheme)
	provider := apiserver.NewRESTStorageProvider(c.CompletedConfig.RESTOptionsGetter)
	for _, g := range c.ExtraConfig.ResourceGroups {
		apiGroupInfo, err := g.APIGroupInfo(provider, apiserver.APIGroupInfoOptions{
			Scheme:         scheme,
			Codecs:         codecs,
			ParameterCodec: parameterCodec,
		})
		if err != nil {
			return nil, err
		}
		if err := s.GenericAPIServer.InstallAPIGroup(apiGroupInfo); err != nil {
			return nil, err
		}
	}

	return s, nil
}
