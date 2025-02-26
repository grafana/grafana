package options

import (
	"github.com/spf13/pflag"
	v1 "k8s.io/api/apps/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericfeatures "k8s.io/apiserver/pkg/features"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/server/resourceconfig"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	apiregistrationv1beta1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1beta1"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"

	servicev0alpha1 "github.com/grafana/grafana/pkg/apis/service/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// KubeAggregatorOptions contains the state for the aggregator apiserver
type KubeAggregatorOptions struct {
	AlternateDNS           []string
	ProxyClientCertFile    string
	ProxyClientKeyFile     string
	LegacyClientCertAuth   bool
	RemoteServicesFile     string
	APIServiceCABundleFile string
}

func NewAggregatorServerOptions() *KubeAggregatorOptions {
	return &KubeAggregatorOptions{}
}

func (o *KubeAggregatorOptions) AddFlags(fs *pflag.FlagSet) {
	if o == nil {
		return
	}

	// the following two config variables are slated to be faded out in cloud deployments after which
	// their scope is restricted to local development and non Grafana Cloud use-cases only
	// leaving them unspecified leads to graceful behavior in grafana-aggregator
	// and would work for configurations where the aggregated servers and aggregator are auth-less and trusting
	// of each other
	fs.StringVar(&o.ProxyClientCertFile, "proxy-client-cert-file", o.ProxyClientCertFile,
		"path to proxy client cert file")

	fs.StringVar(&o.ProxyClientKeyFile, "proxy-client-key-file", o.ProxyClientKeyFile,
		"path to proxy client key file")

	fs.BoolVar(&o.LegacyClientCertAuth, "legacy-client-cert-auth", true,
		"whether to use legacy client cert auth")
}

func (o *KubeAggregatorOptions) Validate() []error {
	if o == nil {
		return nil
	}

	// TODO: do we need to validate anything here?
	return nil
}

func (o *KubeAggregatorOptions) ApplyTo(aggregatorConfig *aggregatorapiserver.Config, etcdOpts *options.EtcdOptions) error {
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
	// override the RESTOptionsGetter to use the in memory storage options
	restOptionsGetter, err := apistore.NewRESTOptionsGetterMemory(etcdOptions.StorageConfig)
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

	aggregatorConfig.ExtraConfig.ProxyClientCertFile = o.ProxyClientCertFile
	aggregatorConfig.ExtraConfig.ProxyClientKeyFile = o.ProxyClientKeyFile

	genericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}

	// These hooks use v1 informers, which are not available in the grafana aggregator.
	genericConfig.DisabledPostStartHooks = genericConfig.DisabledPostStartHooks.Insert("start-kube-aggregator-informers")
	genericConfig.DisabledPostStartHooks = genericConfig.DisabledPostStartHooks.Insert("apiservice-status-local-available-controller")

	return nil
}
