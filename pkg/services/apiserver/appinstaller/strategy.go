package appinstaller

import (
	"context"

	genericrest "k8s.io/apiserver/pkg/registry/rest"
)

type updateStrategyWrapper struct {
	genericrest.RESTUpdateStrategy
}

func (s *updateStrategyWrapper) AllowCreateOnUpdate(ctx context.Context) bool {
	// needed for dual write to work correctly
	return true
}

func (s *updateStrategyWrapper) AllowUnconditionalUpdate(ctx context.Context) bool {
	// needed for dual write to work correctly
	return true
}
