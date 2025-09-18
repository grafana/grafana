package mocks

import (
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
)

// Mocks for config checks

type mockManagedPlugins struct {
	managedplugins.Manager
}

type mockProvisionedPlugins struct {
	provisionedplugins.Manager
}
