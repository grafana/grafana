package jaeger

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/tsdb/jaeger/types"
)

func TestTransformDependenciesResponse(t *testing.T) {
	t.Run("simple_dependencies", func(t *testing.T) {
		dependencies := types.DependenciesResponse{
			Data: []types.ServiceDependency{
				{
					Parent:    "serviceA",
					Child:     "serviceB",
					CallCount: 1,
				},
				{
					Parent:    "serviceA",
					Child:     "serviceC",
					CallCount: 2,
				},
				{
					Parent:    "serviceB",
					Child:     "serviceC",
					CallCount: 3,
				},
			},
		}

		frames := transformDependenciesResponse(dependencies, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "simple_dependencies_nodes.golden", frames[0], false)
		experimental.CheckGoldenJSONFrame(t, "./testdata", "simple_dependencies_edges.golden", frames[1], false)
	})

	t.Run("empty_dependencies", func(t *testing.T) {
		dependencies := types.DependenciesResponse{
			Data: []types.ServiceDependency{},
		}

		frames := transformDependenciesResponse(dependencies, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "empty_dependencies_nodes.golden", frames[0], false)
		experimental.CheckGoldenJSONFrame(t, "./testdata", "empty_dependencies_edges.golden", frames[1], false)
	})

	t.Run("complex_dependencies", func(t *testing.T) {
		dependencies := types.DependenciesResponse{
			Data: []types.ServiceDependency{
				{
					Parent:    "frontend",
					Child:     "auth-service",
					CallCount: 150,
				},
				{
					Parent:    "frontend",
					Child:     "api-gateway",
					CallCount: 300,
				},
				{
					Parent:    "api-gateway",
					Child:     "user-service",
					CallCount: 200,
				},
				{
					Parent:    "api-gateway",
					Child:     "order-service",
					CallCount: 100,
				},
				{
					Parent:    "order-service",
					Child:     "payment-service",
					CallCount: 80,
				},
				{
					Parent:    "order-service",
					Child:     "inventory-service",
					CallCount: 90,
				},
				{
					Parent:    "user-service",
					Child:     "database",
					CallCount: 500,
				},
				{
					Parent:    "payment-service",
					Child:     "database",
					CallCount: 200,
				},
				{
					Parent:    "inventory-service",
					Child:     "database",
					CallCount: 300,
				},
			},
		}

		frames := transformDependenciesResponse(dependencies, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "complex_dependencies_nodes.golden", frames[0], false)
		experimental.CheckGoldenJSONFrame(t, "./testdata", "complex_dependencies_edges.golden", frames[1], false)
	})
}
