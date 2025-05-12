package aggregatorrunner

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
)

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
}
