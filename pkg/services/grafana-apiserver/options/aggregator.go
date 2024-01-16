package options

import (
	"github.com/spf13/pflag"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/resourceconfig"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"
	aggregatoropenapi "k8s.io/kube-aggregator/pkg/generated/openapi"
	"k8s.io/kube-openapi/pkg/common"

	informersv0alpha1 "github.com/grafana/grafana/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/registry/apis/service"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/builder"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/openapi"
)

// AggregatorServerOptions contains the state for the aggregator apiserver
type AggregatorServerOptions struct {
	Builders            []builder.APIGroupBuilder
	AlternateDNS        []string
	ProxyClientCertFile string
	ProxyClientKeyFile  string

	sharedInformerFactory informersv0alpha1.SharedInformerFactory
}

func NewAggregatorServerOptions() *AggregatorServerOptions {
	return &AggregatorServerOptions{
		Builders: []builder.APIGroupBuilder{
			service.NewServiceAPIBuilder(),
		},
	}
}

func (o *AggregatorServerOptions) LoadAPIGroupBuilders() error {
	// Install schemas
	for _, b := range o.Builders {
		if err := b.InstallSchema(aggregatorscheme.Scheme); err != nil {
			return err
		}
	}
	return nil
}

func (o *AggregatorServerOptions) getMergedOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	// Add OpenAPI specs for each group+version
	prerequisiteAPIs := openapi.GetOpenAPIDefinitions(o.Builders)(ref)
	aggregatorAPIs := aggregatoropenapi.GetOpenAPIDefinitions(ref)

	for k, v := range prerequisiteAPIs {
		aggregatorAPIs[k] = v
	}

	return aggregatorAPIs
}

func (o *AggregatorServerOptions) AddFlags(fs *pflag.FlagSet) {
	if o == nil {
		return
	}

	fs.StringVar(&o.ProxyClientCertFile, "proxy-client-cert-file", o.ProxyClientCertFile,
		"path to proxy client cert file")

	fs.StringVar(&o.ProxyClientKeyFile, "proxy-client-key-file", o.ProxyClientKeyFile,
		"path to proxy client cert file")
}

func (o *AggregatorServerOptions) Validate() []error {
	if o == nil {
		return nil
	}

	// TODO: do we need to validate anything here?

	return nil
}

func (o *AggregatorServerOptions) ApplyTo(aggregatorConfig *aggregatorapiserver.Config) error {
	genericConfig := aggregatorConfig.GenericConfig

	// prevent generic API server from installing the OpenAPI handler. Aggregator server
	// has its own customized OpenAPI handler.
	genericConfig.SkipOpenAPIInstallation = true
	mergedResourceConfig, err := resourceconfig.MergeAPIResourceConfigs(aggregatorapiserver.DefaultAPIResourceConfigSource(), nil, aggregatorscheme.Scheme)
	if err != nil {
		return err
	}
	genericConfig.MergedResourceConfig = mergedResourceConfig

	namer := openapinamer.NewDefinitionNamer(aggregatorscheme.Scheme)
	genericConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(o.getMergedOpenAPIDefinitions, namer)
	genericConfig.OpenAPIV3Config.Info.Title = "Kubernetes"
	genericConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(o.getMergedOpenAPIDefinitions, namer)
	genericConfig.OpenAPIConfig.Info.Title = "Kubernetes"

	return nil
}
