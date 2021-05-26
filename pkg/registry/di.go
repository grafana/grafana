package registry

import (
	"fmt"

	"github.com/facebookgo/inject"
)

// BuildServiceGraph builds a graph of services and their dependencies.
// The services are initialized after the graph is built.
func BuildServiceGraph(objs []interface{}, services []*Descriptor) error {
	if services == nil {
		services = GetServices()
	}
	for _, service := range services {
		objs = append(objs, service.Instance)
	}

	serviceGraph := inject.Graph{}

	// Provide services and their dependencies to the graph.
	for _, obj := range objs {
		if err := serviceGraph.Provide(&inject.Object{Value: obj}); err != nil {
			return fmt.Errorf("failed to provide object to the graph: %w", err)
		}
	}

	// Resolve services and their dependencies.
	if err := serviceGraph.Populate(); err != nil {
		return fmt.Errorf("failed to populate service dependencies: %w", err)
	}

	// Initialize services.
	for _, service := range services {
		if IsDisabled(service.Instance) {
			continue
		}

		if err := service.Instance.Init(); err != nil {
			return fmt.Errorf("service init failed: %w", err)
		}
	}

	return nil
}
