package server

import (
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"go.opentelemetry.io/otel/trace"
)

func (ms *ModuleServer) initGRPCServer(authn interceptors.Authenticator, tracer trace.Tracer) (services.Service, error) {
	handler, err := grpcserver.ProvideService(ms.cfg, ms.features, authn, tracer, ms.registerer)
	if err != nil {
		return nil, err
	}

	ms.grpcService = grpcserver.ProvideDSKitService(handler, modules.GRPCServer)
	return ms.grpcService, nil
}
