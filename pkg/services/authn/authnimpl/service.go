package authnimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
)

var _ authn.Service = new(Service)

func ProvideService(cfg *setting.Cfg, tracer tracing.Tracer) *Service {
	return &Service{
		clients: make(map[string]authn.Client),
		tracer:  tracer,
	}
}

type Service struct {
	clients map[string]authn.Client

	tracer tracing.Tracer
}

func (s *Service) Authenticate(ctx context.Context, client string, r *authn.Request) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.Authenticate")
	defer span.End()

	span.SetAttributes("authn.client", client, attribute.Key("authn.client").String(client))

	panic("implement me")
}
