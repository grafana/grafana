package authnimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
)

var _ authn.Service = new(Service)

func ProvideService(cfg *setting.Cfg, tracer tracing.Tracer, orgService org.Service, apikeyService apikey.Service, userService user.Service) *Service {
	s := &Service{
		log:         log.New("authn.service"),
		cfg:         cfg,
		clients:     make(map[string]authn.Client),
		tracer:      tracer,
		userService: userService,
	}

	s.clients[authn.ClientAPIKey] = clients.ProvideAPIKey(apikeyService, userService)

	if s.cfg.AnonymousEnabled {
		s.clients[authn.ClientAnonymous] = clients.ProvideAnonymous(cfg, orgService)
	}

	return s
}

type Service struct {
	log     log.Logger
	cfg     *setting.Cfg
	clients map[string]authn.Client

	tracer      tracing.Tracer
	userService user.Service
}

func (s *Service) Authenticate(ctx context.Context, client string, r *authn.Request) (*authn.Identity, bool, error) {
	ctx, span := s.tracer.Start(ctx, "authn.Authenticate")
	defer span.End()

	span.SetAttributes("authn.client", client, attribute.Key("authn.client").String(client))
	logger := s.log.FromContext(ctx)

	c, ok := s.clients[client]
	if !ok {
		logger.Debug("auth client not found", "client", client)
		span.AddEvents([]string{"message"}, []tracing.EventValue{{Str: "auth client is not configured"}})
		return nil, false, nil
	}

	if !c.Test(ctx, r) {
		logger.Debug("auth client cannot handle request", "client", client)
		span.AddEvents([]string{"message"}, []tracing.EventValue{{Str: "auth client cannot handle request"}})
		return nil, false, nil
	}

	identity, err := c.Authenticate(ctx, r)
	if err != nil {
		logger.Warn("auth client could not authenticate request", "client", client, "err", err)
		span.AddEvents([]string{"message"}, []tracing.EventValue{{Str: "auth client could not authenticate request"}})
		return nil, true, err
	}

	// FIXME: We want to perform common authentication operations here.
	// We will add them as we start to implement clients that requires them.
	// Those operations can be Syncing user, syncing teams, create a session etc.
	// We would need to check what operations a client support and also if they are requested
	// because for e.g. basic auth we want to create a session if the call is coming from the
	// login handler, but if we want to perform basic auth during a request (called from contexthandler) we don't
	// want a session to be created.

	logger.Debug("auth client successfully authenticated request", "client", client, "identity", identity)
	return identity, true, nil
}
