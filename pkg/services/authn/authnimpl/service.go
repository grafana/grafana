package authnimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	sync "github.com/grafana/grafana/pkg/services/authn/authnimpl/usersync"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
)

var _ authn.Service = new(Service)

func ProvideService(cfg *setting.Cfg, tracer tracing.Tracer, orgService org.Service) *Service {
	s := &Service{
		log:           log.New("authn.service"),
		cfg:           cfg,
		clients:       make(map[string]authn.Client),
		tracer:        tracer,
		postAuthHooks: []authn.PostAuthHookFn{},
	}

	if s.cfg.AnonymousEnabled {
		s.clients[authn.ClientAnonymous] = clients.ProvideAnonymous(cfg, orgService)
	}

	// FIXME (jguer): move to User package
	userSyncService := &sync.UserSync{}
	orgUserSyncService := &sync.OrgSync{}
	s.RegisterPostAuthHook(userSyncService.SyncUser)
	s.RegisterPostAuthHook(orgUserSyncService.SyncOrgUser)

	return s
}

type Service struct {
	log     log.Logger
	cfg     *setting.Cfg
	clients map[string]authn.Client

	// postAuthHooks are called after a successful authentication. They can modify the identity.
	postAuthHooks []authn.PostAuthHookFn

	tracer tracing.Tracer
}

func (s *Service) Authenticate(ctx context.Context, clientName string, r *authn.Request) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.Authenticate")
	defer span.End()

	span.SetAttributes("authn.client", clientName, attribute.Key("authn.client").String(clientName))

	client, ok := s.clients[clientName]
	if !ok {
		s.log.FromContext(ctx).Warn("auth client not found", "client", clientName)
		span.AddEvents([]string{"message"}, []tracing.EventValue{{Str: "auth client is not configured"}})
		return nil, authn.ErrClientNotFound
	}

	identity, err := client.Authenticate(ctx, r)
	if err != nil {
		span.AddEvents([]string{"message"}, []tracing.EventValue{{Str: "auth client failed"}})
		return nil, err
	}
	// FIXME: We want to perform common authentication operations here.
	// We will add them as we start to implement clients that requires them.
	// Those operations can be Syncing user, syncing teams, create a session etc.
	// We would need to check what operations a client support and also if they are requested
	// because for e.g. basic auth we want to create a session if the call is coming from the
	// login handler, but if we want to perform basic auth during a request (called from contexthandler) we don't
	// want a session to be created.

	for _, hook := range s.postAuthHooks {
		if err := hook(ctx, &authn.ClientParams{}, identity); err != nil {
			return nil, err
		}
	}

	return identity, err
}

func (s *Service) RegisterPostAuthHook(hook authn.PostAuthHookFn) {
	s.postAuthHooks = append(s.postAuthHooks, hook)
}
