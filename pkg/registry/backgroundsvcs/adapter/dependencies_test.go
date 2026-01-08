package adapter

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDependencyMap(t *testing.T) {
	t.Run("ensure every module except `BackgroundServices` is a dependency of another module", func(t *testing.T) {
		deps := dependencyMap()
		for module := range deps {
			// it's safe to ignore the `BackgroundServices` module
			if module == BackgroundServices {
				continue
			}
			found := false
			for _, moduleDeps := range deps {
				if slices.Contains(moduleDeps, module) {
					found = true
					break
				}
			}
			require.True(t, found, "module %s is not a dependency of any other module", module)
		}
	})
}
