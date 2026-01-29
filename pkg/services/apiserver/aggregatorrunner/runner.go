package aggregatorrunner

import (
	"context"

	apiextensionsinformers "k8s.io/apiextensions-apiserver/pkg/client/informers/externalversions/apiextensions/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
)

// AutoAuthorizerRegistration is an interface for dynamically registering
// authorizers for CRD API groups. This enables authorization for dynamically
// created CRD APIs without requiring a server restart.
//
// This interface is duplicated here to avoid import cycles with the
// embeddedapiserver/aggregator package.
type AutoAuthorizerRegistration interface {
	// AddAuthorizerForGroup registers an authorizer for a CRD API group.
	AddAuthorizerForGroup(gv schema.GroupVersion)
	// RemoveAuthorizerForGroup removes the authorizer for a CRD API group.
	RemoveAuthorizerForGroup(gv schema.GroupVersion)
}

// AggregatorRunner is an interface for running an aggregator inside the same generic apiserver delegate chain
type AggregatorRunner interface {
	// Configure is called to configure the component and returns the delegate for further chaining.
	Configure(opts *options.Options,
		config *genericapiserver.RecommendedConfig,
		delegateAPIServer genericapiserver.DelegationTarget,
		scheme *runtime.Scheme,
		builders []builder.APIGroupBuilder) (*genericapiserver.GenericAPIServer, error)

	// Run starts the complete apiserver chain, expects it executes any logic inside a goroutine and doesn't block. Returns the running server.
	Run(ctx context.Context, transport *options.RoundTripperFunc, stoppedCh chan error) (*genericapiserver.GenericAPIServer, error)

	// SetCRDInformer sets the CRD informer for auto-registering APIServices for CRDs.
	// This should be called before Configure if CRD API is enabled.
	SetCRDInformer(informer apiextensionsinformers.CustomResourceDefinitionInformer)

	// SetAuthorizerRegistration sets the authorizer registration for dynamically registering
	// authorizers for CRD API groups. This should be called before Configure if CRD API is enabled.
	SetAuthorizerRegistration(registration AutoAuthorizerRegistration)
}
