package options

import (
	"maps"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/server/resourceconfig"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/spf13/pflag"

	"github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	aggregatorapiserver "github.com/grafana/grafana/pkg/aggregator/apiserver"
	aggregatorscheme "github.com/grafana/grafana/pkg/aggregator/apiserver/scheme"
	commonv0alpha1 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// GrafanaAggregatorOptions contains the state for the aggregator apiserver
type GrafanaAggregatorOptions struct {
}

func NewGrafanaAggregatorOptions() *GrafanaAggregatorOptions {
	return &GrafanaAggregatorOptions{}
}

func (o *GrafanaAggregatorOptions) AddFlags(fs *pflag.FlagSet) {
	if o == nil {
		return
	}
	// TODO: do we need any CLI flags here?
}

func (o *GrafanaAggregatorOptions) Validate() []error {
	if o == nil {
		return nil
	}

	// TODO: do we need to validate anything here?
	return nil
}

func (o *GrafanaAggregatorOptions) ApplyTo(aggregatorConfig *aggregatorapiserver.Config, etcdOpts *options.EtcdOptions) error {
	genericConfig := aggregatorConfig.GenericConfig

	genericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}
	genericConfig.RESTOptionsGetter = nil

	getOpenAPIDefinitions := func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		defs := commonv0alpha1.GetOpenAPIDefinitions(ref)
		maps.Copy(defs, v0alpha1.GetOpenAPIDefinitions(ref))
		return defs
	}

	genericConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(getOpenAPIDefinitions, openapi.NewDefinitionNamer(aggregatorscheme.Scheme))
	genericConfig.OpenAPIConfig.Info.Title = "Grafana Aggregator"
	genericConfig.OpenAPIConfig.Info.Version = "0.1"

	genericConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(getOpenAPIDefinitions, openapi.NewDefinitionNamer(aggregatorscheme.Scheme))
	genericConfig.OpenAPIV3Config.Info.Title = "Grafana Aggregator"
	genericConfig.OpenAPIV3Config.Info.Version = "0.1"

	// copy the etcd options so we don't mutate originals.
	// we assume that the etcd options have been completed already.  avoid messing with anything outside
	// of changes to StorageConfig as that may lead to unexpected behavior when the options are applied.
	etcdOptions := *etcdOpts
	etcdOptions.StorageConfig.Codec = aggregatorscheme.Codecs.LegacyCodec(v0alpha1.SchemeGroupVersion)
	etcdOptions.StorageConfig.EncodeVersioner = runtime.NewMultiGroupVersioner(v0alpha1.SchemeGroupVersion, schema.GroupKind{Group: v0alpha1.SchemeGroupVersion.Group})
	etcdOptions.SkipHealthEndpoints = true // avoid double wiring of health checks
	if err := etcdOptions.ApplyTo(&genericConfig.Config); err != nil {
		return err
	}
	// override the RESTOptionsGetter to use the in memory storage options
	restOptionsGetter, err := apistore.NewRESTOptionsGetterMemory(etcdOptions.StorageConfig, nil)
	if err != nil {
		return err
	}
	aggregatorConfig.GenericConfig.RESTOptionsGetter = restOptionsGetter

	// prevent generic API server from installing the OpenAPI handler. Aggregator server has its own customized OpenAPI handler.
	genericConfig.SkipOpenAPIInstallation = true
	mergedResourceConfig, err := resourceconfig.MergeAPIResourceConfigs(aggregatorapiserver.DefaultAPIResourceConfigSource(), nil, aggregatorscheme.Scheme)
	if err != nil {
		return err
	}
	genericConfig.MergedResourceConfig = mergedResourceConfig

	return nil
}
