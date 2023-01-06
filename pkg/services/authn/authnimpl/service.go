package authnimpl

import (
	"context"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	sync "github.com/grafana/grafana/pkg/services/authn/authnimpl/usersync"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
)

// make sure service implements authn.Service interface
var _ authn.Service = new(Service)

func ProvideService(
	cfg *setting.Cfg, tracer tracing.Tracer,
	orgService org.Service, sessionService auth.UserTokenService,
	accessControlService accesscontrol.Service,
	apikeyService apikey.Service, userService user.Service,
	loginAttempts loginattempt.Service, quotaService quota.Service,
	authInfoService login.AuthInfoService, renderService rendering.Service,
) *Service {
	s := &Service{
		log:           log.New("authn.service"),
		cfg:           cfg,
		clients:       make(map[string]authn.Client),
		tracer:        tracer,
		postAuthHooks: []authn.PostAuthHookFn{},
	}

	s.clients[authn.ClientRender] = clients.ProvideRender(userService, renderService)
	s.clients[authn.ClientAPIKey] = clients.ProvideAPIKey(apikeyService, userService)

	sessionClient := clients.ProvideSession(sessionService, userService, cfg.LoginCookieName, cfg.LoginMaxLifetime)
	s.clients[authn.ClientSession] = sessionClient
	s.RegisterPostAuthHook(sessionClient.RefreshTokenHook)

	if s.cfg.AnonymousEnabled {
		s.clients[authn.ClientAnonymous] = clients.ProvideAnonymous(cfg, orgService)
	}

	// FIXME (kalleep): handle cfg.DisableLogin as well?
	if s.cfg.BasicAuthEnabled && !s.cfg.DisableLogin {
		s.clients[authn.ClientBasic] = clients.ProvideBasic(userService, loginAttempts)
	}

	// FIXME (jguer): move to User package
	userSyncService := sync.ProvideUserSync(userService, authInfoService, quotaService)
	orgUserSyncService := sync.ProvideOrgSync(userService, orgService, accessControlService)
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
	tracer        tracing.Tracer
}

func (s *Service) Authenticate(ctx context.Context, client string, r *authn.Request) (*authn.Identity, bool, error) {
	c, ok := s.clients[client]
	if !ok {
		return nil, false, nil
	}

	if !c.Test(ctx, r) {
		return nil, false, nil
	}

	ctx, span := s.tracer.Start(ctx, "authn.Authenticate")
	defer span.End()
	span.SetAttributes("authn.client", client, attribute.Key("authn.client").String(client))

	r.OrgID = orgIDFromRequest(r)
	identity, err := c.Authenticate(ctx, r)
	if err != nil {
		s.log.FromContext(ctx).Warn("auth client could not authenticate request", "client", client, "error", err)
		span.AddEvents([]string{"message"}, []tracing.EventValue{{Str: "auth client could not authenticate request"}})
		return nil, true, err
	}

	for _, hook := range s.postAuthHooks {
		if err := hook(ctx, identity, r); err != nil {
			return nil, false, err
		}
	}

	return identity, true, nil
}

func (s *Service) RegisterPostAuthHook(hook authn.PostAuthHookFn) {
	s.postAuthHooks = append(s.postAuthHooks, hook)
}

func orgIDFromRequest(r *authn.Request) int64 {
	if r.HTTPRequest == nil {
		return 0
	}

	orgID := orgIDFromQuery(r.HTTPRequest)
	if orgID > 0 {
		return orgID
	}

	return orgIDFromHeader(r.HTTPRequest)
}

// name of query string used to target specific org for request
const orgIDTargetQuery = "targetOrgId"

func orgIDFromQuery(req *http.Request) int64 {
	params := req.URL.Query()
	if !params.Has(orgIDTargetQuery) {
		return 0
	}
	id, err := strconv.ParseInt(params.Get(orgIDTargetQuery), 10, 64)
	if err != nil {
		return 0
	}
	return id
}

// name of header containing org id for request
const orgIDHeaderName = "X-Grafana-Org-Id"

func orgIDFromHeader(req *http.Request) int64 {
	header := req.Header.Get(orgIDHeaderName)
	if header == "" {
		return 0
	}
	id, err := strconv.ParseInt(header, 10, 64)
	if err != nil {
		return 0
	}
	return id
}
