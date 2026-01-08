package appinstaller

import (
	genericrest "k8s.io/apiserver/pkg/registry/rest"
)

type updateStrategyWrapper struct {
	genericrest.RESTUpdateStrategy
}

func (s *updateStrategyWrapper) AllowCreateOnUpdate() bool {
	// needed for dual write to work correctly
	return true
}

func (s *updateStrategyWrapper) AllowUnconditionalUpdate() bool {
	// needed for dual write to work correctly
	return true
}
