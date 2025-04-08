package options

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

// ExtraRunner is an interface for additional components that can be run alongside the API server.
type ExtraRunner interface {
	// Run starts the component and blocks until the context is cancelled or an error occurs.
	Run(ctx context.Context, opts *Options, config *genericapiserver.RecommendedConfig, coreAPIServerGroupVersions []schema.GroupVersion) error
}

type ExtraRunnerConfigurator interface {
	GetExtraRunners() []ExtraRunner
}
