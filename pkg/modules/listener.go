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
	service *Service
}

func newServiceListener(logger log.Logger, s *Service) *serviceListener {
	return &serviceListener{log: logger.New("service-listener"), service: s}
}

func (l *serviceListener) Healthy() {
	l.log.Info("All modules healthy")
}

func (l *serviceListener) Stopped() {
	l.log.Info("All modules stopped")
}

func (l *serviceListener) Failure(service services.Service) {
	// if any service fails, stop all services
	if err := l.service.Shutdown(context.Background()); err != nil {
		l.log.Error("Failed to stop all modules", "err", err)
	}

	// log which module failed
	for module, s := range l.service.ServiceMap {
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
