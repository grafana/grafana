package aggregatorrunner

import (
	"fmt"

	apiextensionsinformers "k8s.io/apiextensions-apiserver/pkg/client/informers/externalversions/apiextensions/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
)

// AggregatorOptions contains ALL configuration for the aggregator.
// This follows the Kubernetes pattern of using a single options struct
// for all configuration instead of multiple positional parameters.
type AggregatorOptions struct {
	// Core apiserver options (required)
	BaseOptions *options.Options

	// Config is the recommended config for the apiserver (required)
	Config *genericapiserver.RecommendedConfig

	// DelegateAPIServer is the delegation target for the aggregator (required)
	// This is typically the apiextensions server or an empty delegate
	DelegateAPIServer genericapiserver.DelegationTarget

	// Scheme is the runtime scheme for the apiserver (required)
	Scheme *runtime.Scheme

	// Builders is the list of API group builders (required)
	Builders []builder.APIGroupBuilder

	// From apiextensions (optional - nil if apiextensions is not enabled)
	// CRDInformer is used to auto-register APIServices for CRDs
	CRDInformer apiextensionsinformers.CustomResourceDefinitionInformer

	// AuthorizerRegistration is used for dynamically registering authorizers
	// for CRD API groups. This is used in MT mode with apiextensions enabled.
	AuthorizerRegistration AutoAuthorizerRegistration

	// Aggregator-specific configuration (optional)
	// LocalOnlyAggregation when true, disables remote service aggregation
	LocalOnlyAggregation bool

	// ProxyClientCertFile is the path to the client certificate for proxy requests
	ProxyClientCertFile string

	// ProxyClientKeyFile is the path to the client key for proxy requests
	ProxyClientKeyFile string
}

// Validate checks that required options are set.
func (o *AggregatorOptions) Validate() []error {
	var errs []error
	if o.Config == nil {
		errs = append(errs, fmt.Errorf("Config is required"))
	}
	if o.DelegateAPIServer == nil {
		errs = append(errs, fmt.Errorf("DelegateAPIServer is required"))
	}
	if o.Scheme == nil {
		errs = append(errs, fmt.Errorf("Scheme is required"))
	}
	return errs
}
