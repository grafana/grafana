package tracing

import (
	"context"
	"slices"
	"sync"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"
)

type initFn func() (services.Service, error)

type ModuleManagerWrapper struct {
	ready chan struct{}
	ctx   context.Context
	*modules.Manager

	mu          sync.Mutex
	listeners   []*Listener
	shutdownCtx context.Context
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

// SetShutdownContext parents every service's shutdown spans on ctx, so the whole
// shutdown forms one trace. Call it before shutdown starts, or services reaching
// Stopping first start their own.
func (m *ModuleManagerWrapper) SetShutdownContext(ctx context.Context) {
	m.mu.Lock()
	m.shutdownCtx = ctx
	listeners := slices.Clone(m.listeners)
	m.mu.Unlock()

	for _, l := range listeners {
		l.SetShutdownContext(ctx)
	}
}

// WaitForListeners blocks until every listener has closed its spans, or ctx is done.
// dskit delivers state transitions on a goroutine per listener, so a Terminated
// service does not mean its spans are closed.
func (m *ModuleManagerWrapper) WaitForListeners(ctx context.Context) {
	m.mu.Lock()
	listeners := slices.Clone(m.listeners)
	m.mu.Unlock()

	for _, l := range listeners {
		select {
		case <-l.Done():
		case <-ctx.Done():
			return
		}
	}
}

// ShutdownContext returns the context set by SetShutdownContext, or a background
// context when shutdown was triggered without one.
func (m *ModuleManagerWrapper) ShutdownContext() context.Context {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.shutdownCtx == nil {
		return context.Background()
	}
	return m.shutdownCtx
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
			namedService.AddListener(m.newListener(namedService.ServiceName()))
		}
		return service, nil
	}
}

func (m *ModuleManagerWrapper) newListener(serviceName string) *Listener {
	l := NewListener(m.getContext(), serviceName)

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.shutdownCtx != nil {
		l.SetShutdownContext(m.shutdownCtx)
	}
	m.listeners = append(m.listeners, l)
	return l
}
