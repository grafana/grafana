package registry

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
)

func TestRegistry(t *testing.T) {
	var registeredInvisibleModules []string
	var registeredModules []string

	moduleManager := &modules.MockModuleManager{
		RegisterModuleFunc: func(name string, initFn func() (services.Service, error)) {
			registeredModules = append(registeredModules, name)
		},
		RegisterInvisibleModuleFunc: func(name string, initFn func() (services.Service, error)) {
			registeredInvisibleModules = append(registeredInvisibleModules, name)
		},
	}

	mockSvcName := "test-registry"
	mockSvc := modules.NewMockNamedService(mockSvcName)

	r := newRegistry(log.New("modules.registry"), moduleManager, mockSvc)
	require.NotNil(t, r)
	require.Equal(t, []string{mockSvcName}, registeredInvisibleModules)
	require.Equal(t, []string{modules.All}, registeredModules)
}
