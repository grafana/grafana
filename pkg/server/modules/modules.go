package modules

import (
	"context"

	"github.com/go-kit/log/level"
	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/store/kind"
	objectdummyserver "github.com/grafana/grafana/pkg/services/store/object/dummy"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	All                   string = "all"
	GRPCServer            string = "grpc-server"
	GRPCServerHealthCheck string = "grpc-server-health-check"
	GRPCServerReflection  string = "grpc-server-reflection"
	ObjectStore           string = "object-store"
)

type Modules struct {
	cfg *setting.Cfg
	log log.Logger

	// services
	grpcServer   grpcserver.Provider
	kindRegistry kind.KindRegistry

	// dskit modules
	ModuleManager *modules.Manager
	serviceMap    map[string]services.Service
	deps          map[string][]string
}

func ProvideService(cfg *setting.Cfg, server grpcserver.Provider, kindRegistry kind.KindRegistry) *Modules {
	m := &Modules{
		cfg: cfg,
		log: log.New("modules"),

		grpcServer:   server,
		kindRegistry: kindRegistry,
	}
	return m
}

func (m *Modules) Init() error {
	mm := modules.NewManager(m.log)
	mm.RegisterModule(GRPCServer, m.initGRPCServer, modules.UserInvisibleModule)
	mm.RegisterModule(GRPCServerHealthCheck, m.initGRPCServerHealthCheck, modules.UserInvisibleModule)
	mm.RegisterModule(GRPCServerReflection, m.initGRPCServerReflection, modules.UserInvisibleModule)
	mm.RegisterModule(ObjectStore, m.initObjectStore)
	mm.RegisterModule(All, nil)

	deps := map[string][]string{
		GRPCServer:  {GRPCServerHealthCheck, GRPCServerReflection},
		ObjectStore: {GRPCServer},
		All:         {ObjectStore},
	}

	for mod, targets := range deps {
		if err := mm.AddDependency(mod, targets...); err != nil {
			return err
		}
	}

	m.deps = deps
	m.ModuleManager = mm

	return nil
}

func (m *Modules) Run() error {
	serviceMap, err := m.ModuleManager.InitModuleServices(All) // m.cfg.Target...
	if err != nil {
		return err
	}
	m.serviceMap = serviceMap

	var servs []services.Service
	for _, s := range serviceMap {
		servs = append(servs, s)
	}

	m.log.Info("starting services", "services", servs)

	sm, err := services.NewManager(servs...)
	if err != nil {
		return err
	}

	healthy := func() { level.Info(m.log).Log("msg", "Modules started") }
	stopped := func() { level.Info(m.log).Log("msg", "Modules stopped") }
	serviceFailed := func(service services.Service) {
		// if any service fails, stop all services
		sm.StopAsync()

		// let's find out which module failed
		for module, s := range serviceMap {
			if s == service {
				if service.FailureCase() == modules.ErrStopProcess {
					level.Info(m.log).Log("msg", "received stop signal via return error", "module", module, "error", service.FailureCase())
				} else {
					level.Error(m.log).Log("msg", "module failed", "module", module, "error", service.FailureCase())
				}
				return
			}
		}

		level.Error(m.log).Log("msg", "module failed", "module", "unknown", "error", service.FailureCase())
	}

	sm.AddListener(services.NewManagerListener(healthy, stopped, serviceFailed))

	// wait until a service fails or we receive a stop signal
	if err = sm.StartAsync(context.Background()); err == nil {
		err = sm.AwaitStopped(context.Background())
	}

	return nil
}

func (m *Modules) initGRPCServer() (services.Service, error) {
	return m.grpcServer, nil
}

func (m *Modules) initGRPCServerHealthCheck() (services.Service, error) {
	return grpcserver.ProvideHealthService(m.cfg, m.grpcServer)
}

func (m *Modules) initGRPCServerReflection() (services.Service, error) {
	return grpcserver.ProvideReflectionService(m.cfg, m.grpcServer)
}

func (m *Modules) initObjectStore() (services.Service, error) {
	return objectdummyserver.ProvideDummyObjectServer(m.cfg, m.grpcServer, m.kindRegistry), nil
}
