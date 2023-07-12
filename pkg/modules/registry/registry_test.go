package registry

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
)

// TODO: determine if this test makes sense given all the services that need to be passed in
// don't have mock implementations

/* func TestProvideRegistry(t *testing.T) {
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

	svcRegistry := backgroundsvcs.NewBackgroundServiceRegistry()
	svcRunner := backgroundsvcs.ProvideBackgroundServiceRunner(svcRegistry)

	r := ProvideRegistry(log.New("modules.registry"), moduleManager, svcRunner)
	require.NotNil(t, r)
	require.Equal(t, []string{modules.BackgroundServices}, registeredInvisibleModules)
	require.Equal(t, []string{modules.All}, registeredModules)
} */

func TestNewRegistry(t *testing.T) {
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
