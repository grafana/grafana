package options

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

// ExtraRunner is an interface for additional components that can be run alongside the API server.
type ExtraRunner interface {
	// Run starts the component, expects it executes any logic inside a goroutine and doesn't block.
	Run(ctx context.Context, opts *Options, config *genericapiserver.RecommendedConfig, coreAPIServerGroupVersions []schema.GroupVersion) error
}

// ExtraRunnerConfigurator is an interface to fetch any extra runners that should be started.
type ExtraRunnerConfigurator interface {
	GetExtraRunners() []ExtraRunner
}
