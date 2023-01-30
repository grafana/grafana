package modules

import (
	"context"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/server/backgroundsvcs"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	All  string = "all"
	Core string = "core"
)

type Modules struct {
	targets []string
	log     log.Logger

	moduleManager  *modules.Manager
	serviceManager *services.Manager
	serviceMap     map[string]services.Service
	deps           map[string][]string

	backgroundServiceRegistry *backgroundsvcs.BackgroundServiceRegistry
}

func ProvideService(cfg *setting.Cfg, backgroundServiceRegistry *backgroundsvcs.BackgroundServiceRegistry) *Modules {
	return &Modules{
		targets:                   cfg.Target,
		log:                       log.New("modules"),
		backgroundServiceRegistry: backgroundServiceRegistry,
	}
}

func (m *Modules) Init() error {
	mm := modules.NewManager(m.log)
	mm.RegisterModule(Core, m.initBackgroundServices)
	mm.RegisterModule(All, nil)

	deps := map[string][]string{
		Core: {},
		All:  {Core},
	}

	for mod, targets := range deps {
		if err := mm.AddDependency(mod, targets...); err != nil {
			return err
		}
	}

	m.deps = deps
	m.moduleManager = mm

	return nil
}

func (m *Modules) Run() error {
	serviceMap, err := m.moduleManager.InitModuleServices(m.targets...)
	if err != nil {
		return err
	}
	m.serviceMap = serviceMap

	var servs []services.Service
	var keys []string
	for key, s := range serviceMap {
		keys = append(keys, key)
		servs = append(servs, s)
	}

	m.log.Info("Starting services", "services", keys)
	sm, err := services.NewManager(servs...)
	if err != nil {
		return err
	}

	m.serviceManager = sm

	healthy := func() { m.log.Info("Modules started") }
	stopped := func() { m.log.Info("Modules stopped") }
	serviceFailed := func(service services.Service) {
		// if any service fails, stop all services
		sm.StopAsync()

		// log which module failed
		for module, s := range serviceMap {
			if s == service {
				if service.FailureCase() == modules.ErrStopProcess {
					m.log.Info("Received stop signal via return error", "module", module, "err", service.FailureCase())
				} else {
					m.log.Error("Module failed", "module", module, "err", service.FailureCase())
				}
				return
			}
		}

		m.log.Error("Module failed", "module", "unknown", "err", service.FailureCase())
	}

	sm.AddListener(services.NewManagerListener(healthy, stopped, serviceFailed))

	// wait until a service fails or stop signal received
	ctx := context.Background()
	err = sm.StartAsync(ctx)
	if err == nil {
		err = sm.AwaitStopped(ctx)
	}

	if err == nil {
		if failed := sm.ServicesByState()[services.Failed]; len(failed) > 0 {
			for _, f := range failed {
				if f.FailureCase() != modules.ErrStopProcess {
					// Details were reported via failure listener before
					err = f.FailureCase()
					break
				}
			}
		}
	}

	return err
}

func (m *Modules) Stop() error {
	if m.serviceManager != nil {
		m.serviceManager.StopAsync()
		return m.serviceManager.AwaitStopped(context.Background())
	}
	return nil
}

func (m *Modules) initBackgroundServices() (services.Service, error) {
	return m.backgroundServiceRegistry, nil
}
