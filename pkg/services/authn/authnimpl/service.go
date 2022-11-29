package authnimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
)

var _ authn.Service = new(Service)

func ProvideService(cfg *setting.Cfg, tracer tracing.Tracer, orgService org.Service) *Service {
	s := &Service{
		log:     log.New("authn.service"),
		clients: make(map[string]authn.Client),
		tracer:  tracer,
	}

	if s.cfg.AnonymousEnabled {
		s.clients[authn.ClientAnonymous] = clients.ProvideAnonymous(cfg, orgService)
	}

	return s
}

type Service struct {
	log     log.Logger
	cfg     *setting.Cfg
	clients map[string]authn.Client

	tracer tracing.Tracer
}

func (s *Service) Authenticate(ctx context.Context, clientName string, r *authn.Request) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.Authenticate")
	defer span.End()

	span.SetAttributes("authn.client", clientName, attribute.Key("authn.client").String(clientName))

	client, ok := s.clients[clientName]
	if !ok {
		s.log.FromContext(ctx).Warn("auth client not found", "client", clientName)
		return nil, authn.ErrClientNotFound
	}

	return client.Authenticate(ctx, r)
}
