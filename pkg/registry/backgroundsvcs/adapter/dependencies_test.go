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

	t.Run("the NATS bus starts before the API server", func(t *testing.T) {
		deps := dependencyMap()
		require.Subset(t, deps[GrafanaAPIServer], []string{NATSPublisher, NATSSubscriber})
		require.Equal(t, []string{NATSServer}, deps[NATSSubscriber])
		require.Equal(t, []string{NATSServer}, deps[NATSPublisher])
	})

	t.Run("the provisioning connection controller waits for the API server but not for classic provisioning", func(t *testing.T) {
		deps := dependencyMap()
		require.Equal(t, []string{GrafanaAPIServer}, deps[ProvisioningConnectionController])
		require.Contains(t, deps[BackgroundServices], ProvisioningConnectionController)
		require.NotContains(t, deps[Core], ProvisioningConnectionController)
	})

	t.Run("the provisioning repository controller waits for the API server but not for classic provisioning", func(t *testing.T) {
		deps := dependencyMap()
		require.Equal(t, []string{GrafanaAPIServer}, deps[ProvisioningRepositoryController])
		require.Contains(t, deps[BackgroundServices], ProvisioningRepositoryController)
		require.NotContains(t, deps[Core], ProvisioningRepositoryController)
	})
}
