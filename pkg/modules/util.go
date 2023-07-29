package modules

import (
	"context"

	"github.com/grafana/dskit/services"
)

var _ Manager = (*MockModuleManager)(nil)
var _ Engine = (*MockModuleEngine)(nil)

type MockModuleManager struct {
	RegisterModuleFunc          func(name string, initFn func() (services.Service, error))
	RegisterInvisibleModuleFunc func(name string, initFn func() (services.Service, error))
}

func (m *MockModuleManager) RegisterModule(name string, initFn func() (services.Service, error)) {
	if m.RegisterModuleFunc != nil {
		m.RegisterModuleFunc(name, initFn)
	}
}

func (m *MockModuleManager) RegisterInvisibleModule(name string, initFn func() (services.Service, error)) {
	if m.RegisterInvisibleModuleFunc != nil {
		m.RegisterInvisibleModuleFunc(name, initFn)
	}
}

type MockModuleEngine struct {
	InitFunc     func(context.Context) error
	RunFunc      func(context.Context) error
	ShutdownFunc func(context.Context) error
}

func (m *MockModuleEngine) Init(ctx context.Context) error {
	if m.InitFunc != nil {
		return m.InitFunc(ctx)
	}
	return nil
}

func (m *MockModuleEngine) Run(ctx context.Context) error {
	if m.RunFunc != nil {
		return m.RunFunc(ctx)
	}
	return nil
}

func (m *MockModuleEngine) Shutdown(ctx context.Context) error {
	if m.ShutdownFunc != nil {
		return m.ShutdownFunc(ctx)
	}
	return nil
}

func stringsContain(values []string, search string) bool {
	for _, v := range values {
		if search == v {
			return true
		}
	}

	return false
}

type MockNamedService struct {
	*services.BasicService
}

func NewMockNamedService(name string) *MockNamedService {
	startFn := func(_ context.Context) error { return nil }
	return &MockNamedService{
		BasicService: services.NewIdleService(startFn, nil).WithName(name),
	}
}
