package modules

import (
	"context"

	"github.com/grafana/dskit/services"
)

type MockModuleEngine struct {
	RegisterModuleFunc          func(name string, initFn func() (services.Service, error), deps ...string)
	RegisterInvisibleModuleFunc func(name string, initFn func() (services.Service, error), deps ...string)
}

func (m *MockModuleEngine) RegisterModule(name string, initFn func() (services.Service, error), deps ...string) {
	if m.RegisterModuleFunc != nil {
		m.RegisterModuleFunc(name, initFn, deps...)
	}
}

func (m *MockModuleEngine) RegisterInvisibleModule(name string, initFn func() (services.Service, error), deps ...string) {
	if m.RegisterInvisibleModuleFunc != nil {
		m.RegisterInvisibleModuleFunc(name, initFn, deps...)
	}
}

type MockModuleService struct {
	InitFunc     func(context.Context) error
	RunFunc      func(context.Context) error
	ShutdownFunc func(context.Context) error
}

func (m *MockModuleService) Init(ctx context.Context) error {
	if m.InitFunc != nil {
		return m.InitFunc(ctx)
	}
	return nil
}

func (m *MockModuleService) Run(ctx context.Context) error {
	if m.RunFunc != nil {
		return m.RunFunc(ctx)
	}
	return nil
}

func (m *MockModuleService) Shutdown(ctx context.Context) error {
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
