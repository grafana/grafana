package modules

import (
	"context"
	"errors"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
)

var _ services.ManagerListener = (*serviceListener)(nil)

type serviceListener struct {
	log     log.Logger
	service *service
}

func newServiceListener(logger log.Logger, s *service) *serviceListener {
	return &serviceListener{log: logger, service: s}
}

func (l *serviceListener) Healthy() {
	l.log.Info("All modules healthy", "modules", l.moduleNames())
}

func (l *serviceListener) Stopped() {
	l.log.Info("All modules stopped", "modules", l.moduleNames())
}

func (l *serviceListener) moduleNames() []string {
	var ms []string
	for m := range l.service.serviceMap {
		ms = append(ms, m)
	}
	return ms
}

func (l *serviceListener) Failure(service services.Service) {
	// if any service fails, stop all services
	if err := l.service.Shutdown(context.Background()); err != nil {
		l.log.Error("Failed to stop all modules", "err", err)
	}

	// log which module failed
	for module, s := range l.service.serviceMap {
		if s == service {
			if errors.Is(service.FailureCase(), modules.ErrStopProcess) {
				l.log.Info("Received stop signal via return error", "module", module, "err", service.FailureCase())
			} else {
				l.log.Error("Module failed", "module", module, "err", service.FailureCase())
			}
			return
		}
	}

	l.log.Error("Module failed", "module", "unknown", "err", service.FailureCase())
}
