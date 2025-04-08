package options

import (
	"context"
)

// ExtraRunner is an interface for additional components that can be run alongside the API server.
type ExtraRunner interface {
	// Run starts the component and blocks until the context is cancelled or an error occurs.
	Run(ctx context.Context) error
}

type ExtraRunnerConfigurator interface {
	GetExtraRunners() []ExtraRunner
}
