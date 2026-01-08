package tracing

import (
	"context"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"
)

type initFn func() (services.Service, error)

type ModuleManagerWrapper struct {
	ready chan struct{}
	ctx   context.Context
	*modules.Manager
}

func WrapModuleManager(moduleManager *modules.Manager) *ModuleManagerWrapper {
	return &ModuleManagerWrapper{
		ready:   make(chan struct{}),
		Manager: moduleManager,
	}
}

// RegisterModule registers a module without any options
func (m *ModuleManagerWrapper) RegisterModule(name string, fn initFn) {
	var wrappedFn initFn
	if fn != nil {
		wrappedFn = m.wrapInitFn(fn)
	}
	m.Manager.RegisterModule(name, wrappedFn)
}

// RegisterInvisibleModule registers a module with the UserInvisibleModule option
func (m *ModuleManagerWrapper) RegisterInvisibleModule(name string, fn initFn) {
	var wrappedFn initFn
	if fn != nil {
		wrappedFn = m.wrapInitFn(fn)
	}
	m.Manager.RegisterModule(name, wrappedFn, modules.UserInvisibleModule)
}

func (m *ModuleManagerWrapper) SetContext(ctx context.Context) {
	if m.ctx != nil {
		return
	}
	m.ctx = ctx
	close(m.ready)
}

func (m *ModuleManagerWrapper) getContext() context.Context {
	<-m.ready
	return m.ctx
}

func (m *ModuleManagerWrapper) wrapInitFn(fn initFn) initFn {
	return func() (services.Service, error) {
		service, err := fn()
		if err != nil {
			return nil, err
		}
		if service == nil {
			return nil, nil
		}
		if namedService, ok := service.(services.NamedService); ok {
			namedService.AddListener(NewListener(m.getContext(), namedService.ServiceName()))
		}
		return service, nil
	}
}
