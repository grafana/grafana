package options

import (
	"github.com/spf13/pflag"
	v1 "k8s.io/api/apps/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	genericfeatures "k8s.io/apiserver/pkg/features"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/server/resourceconfig"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	apiregistrationv1beta1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1beta1"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"
	aggregatoropenapi "k8s.io/kube-aggregator/pkg/generated/openapi"
	"k8s.io/kube-openapi/pkg/common"

	servicev0alpha1 "github.com/grafana/grafana/pkg/apis/service/v0alpha1"
	filestorage "github.com/grafana/grafana/pkg/apiserver/storage/file"
)

// AggregatorServerOptions contains the state for the aggregator apiserver
type AggregatorServerOptions struct {
	AlternateDNS           []string
	ProxyClientCertFile    string
	ProxyClientKeyFile     string
	RemoteServicesFile     string
	APIServiceCABundleFile string
}

func NewAggregatorServerOptions() *AggregatorServerOptions {
	return &AggregatorServerOptions{}
}

func (o *AggregatorServerOptions) getMergedOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	aggregatorAPIs := aggregatoropenapi.GetOpenAPIDefinitions(ref)
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

func (o *AggregatorServerOptions) ApplyTo(aggregatorConfig *aggregatorapiserver.Config, etcdOpts *options.EtcdOptions, dataPath string) error {
	genericConfig := aggregatorConfig.GenericConfig

	genericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}
	genericConfig.RESTOptionsGetter = nil

	if utilfeature.DefaultFeatureGate.Enabled(genericfeatures.StorageVersionAPI) &&
		utilfeature.DefaultFeatureGate.Enabled(genericfeatures.APIServerIdentity) {
		// Add StorageVersionPrecondition handler to aggregator-apiserver.
		// The handler will block write requests to built-in resources until the
		// target resources' storage versions are up-to-date.
		genericConfig.BuildHandlerChainFunc = genericapiserver.BuildHandlerChainWithStorageVersionPrecondition
	}

	// copy the etcd options so we don't mutate originals.
	// we assume that the etcd options have been completed already.  avoid messing with anything outside
	// of changes to StorageConfig as that may lead to unexpected behavior when the options are applied.
	etcdOptions := *etcdOpts
	etcdOptions.StorageConfig.Codec = aggregatorscheme.Codecs.LegacyCodec(v1.SchemeGroupVersion,
		apiregistrationv1beta1.SchemeGroupVersion,
		servicev0alpha1.SchemeGroupVersion)
	etcdOptions.StorageConfig.EncodeVersioner = runtime.NewMultiGroupVersioner(v1.SchemeGroupVersion,
		schema.GroupKind{Group: apiregistrationv1beta1.GroupName},
		schema.GroupKind{Group: servicev0alpha1.GROUP})
	etcdOptions.SkipHealthEndpoints = true // avoid double wiring of health checks
	if err := etcdOptions.ApplyTo(&genericConfig.Config); err != nil {
		return err
	}
	// override the RESTOptionsGetter to use the file storage options getter
	aggregatorConfig.GenericConfig.RESTOptionsGetter = filestorage.NewRESTOptionsGetter(dataPath, etcdOptions.StorageConfig)

	// prevent generic API server from installing the OpenAPI handler. Aggregator server has its own customized OpenAPI handler.
	genericConfig.SkipOpenAPIInstallation = true
	mergedResourceConfig, err := resourceconfig.MergeAPIResourceConfigs(aggregatorapiserver.DefaultAPIResourceConfigSource(), nil, aggregatorscheme.Scheme)
	if err != nil {
		return err
	}
	genericConfig.MergedResourceConfig = mergedResourceConfig

	aggregatorConfig.ExtraConfig.ProxyClientCertFile = o.ProxyClientCertFile
	aggregatorConfig.ExtraConfig.ProxyClientKeyFile = o.ProxyClientKeyFile

	namer := openapinamer.NewDefinitionNamer(aggregatorscheme.Scheme)
	genericConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(o.getMergedOpenAPIDefinitions, namer)
	genericConfig.OpenAPIV3Config.Info.Title = "Kubernetes"
	genericConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(o.getMergedOpenAPIDefinitions, namer)
	genericConfig.OpenAPIConfig.Info.Title = "Kubernetes"
	genericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}

	// These hooks use v1 informers, which are not available in the grafana aggregator.
	genericConfig.DisabledPostStartHooks = genericConfig.DisabledPostStartHooks.Insert("apiservice-status-available-controller")
	genericConfig.DisabledPostStartHooks = genericConfig.DisabledPostStartHooks.Insert("start-kube-aggregator-informers")

	return nil
}
