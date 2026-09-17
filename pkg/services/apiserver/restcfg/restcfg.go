package restcfg

import (
	"context"

	clientrest "k8s.io/client-go/rest"
)

// RestConfigProvider returns a k8s rest.Config for the loopback transport.
// Defined in a leaf package so consumers can depend on it without pulling in
// the full apiserver dependency graph.
type RestConfigProvider interface {
	GetRestConfig(context.Context) (*clientrest.Config, error)
}
