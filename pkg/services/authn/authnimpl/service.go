package authnimpl

import (
	"context"
	"net/http"
	"strconv"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authnimpl/sync"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/web"
)

const (
	attributeKeyClient = "authn.client"
)

var (
	errDisabledIdentity = errutil.NewBase(errutil.StatusUnauthorized, "identity.disabled")
)

// make sure service implements authn.Service interface
var _ authn.Service = new(Service)

func ProvideService(
	cfg *setting.Cfg, tracer tracing.Tracer,
	orgService org.Service, sessionService auth.UserTokenService,
	accessControlService accesscontrol.Service,
	apikeyService apikey.Service, userService user.Service,
	jwtService auth.JWTVerifierService,
	userProtectionService login.UserProtectionService,
	loginAttempts loginattempt.Service, quotaService quota.Service,
	authInfoService login.AuthInfoService, renderService rendering.Service,
	features *featuremgmt.FeatureManager, oauthTokenService oauthtoken.OAuthTokenService,
) *Service {
	s := &Service{
		log:            log.New("authn.service"),
		cfg:            cfg,
		clients:        make(map[string]authn.Client),
		tracer:         tracer,
		sessionService: sessionService,
		postAuthHooks:  []authn.PostAuthHookFn{},
	}

	s.clients[authn.ClientRender] = clients.ProvideRender(userService, renderService)
	s.clients[authn.ClientAPIKey] = clients.ProvideAPIKey(apikeyService, userService)

	sessionClient := clients.ProvideSession(sessionService, userService, cfg.LoginCookieName, cfg.LoginMaxLifetime)
	s.clients[authn.ClientSession] = sessionClient
	s.RegisterPostAuthHook(sessionClient.RefreshTokenHook)

	if s.cfg.AnonymousEnabled {
		s.clients[authn.ClientAnonymous] = clients.ProvideAnonymous(cfg, orgService)
	}

	var proxyClients []authn.ProxyClient
	var passwordClients []authn.PasswordClient
	if s.cfg.LDAPEnabled {
		ldap := clients.ProvideLDAP(cfg)
		proxyClients = append(proxyClients, ldap)
		passwordClients = append(passwordClients, ldap)
	}

	if !s.cfg.DisableLogin {
		grafana := clients.ProvideGrafana(cfg, userService)
		proxyClients = append(proxyClients, grafana)
		passwordClients = append(passwordClients, grafana)
	}

	// if we have password clients configure check if basic auth or form auth is enabled
	if len(passwordClients) > 0 {
		passwordClient := clients.ProvidePassword(loginAttempts, passwordClients...)
		if s.cfg.BasicAuthEnabled {
			s.clients[authn.ClientBasic] = clients.ProvideBasic(passwordClient)
		}
		// FIXME (kalleep): Remove the global variable and stick it into cfg
		if !setting.DisableLoginForm {
			s.clients[authn.ClientForm] = clients.ProvideForm(passwordClient)
		}
	}

	if s.cfg.AuthProxyEnabled && len(proxyClients) > 0 {
		proxy, err := clients.ProvideProxy(cfg, proxyClients...)
		if err != nil {
			s.log.Error("failed to configure auth proxy", "err", err)
		} else {
			s.clients[authn.ClientProxy] = proxy
		}
	}

	if s.cfg.JWTAuthEnabled {
		s.clients[authn.ClientJWT] = clients.ProvideJWT(jwtService, cfg)
	}

	// FIXME (jguer): move to User package
	userSyncService := sync.ProvideUserSync(userService, userProtectionService, authInfoService, quotaService)
	orgUserSyncService := sync.ProvideOrgSync(userService, orgService, accessControlService)
	s.RegisterPostAuthHook(userSyncService.SyncUser)
	s.RegisterPostAuthHook(orgUserSyncService.SyncOrgUser)
	s.RegisterPostAuthHook(sync.ProvideUserLastSeenSync(userService).SyncLastSeen)
	s.RegisterPostAuthHook(sync.ProvideAPIKeyLastSeenSync(apikeyService).SyncLastSeen)

	if features.IsEnabled(featuremgmt.FlagAccessTokenExpirationCheck) {
		s.RegisterPostAuthHook(sync.ProvideOauthTokenSync(oauthTokenService, sessionService).SyncOauthToken)
	}

	return s
}

type Service struct {
	log     log.Logger
	cfg     *setting.Cfg
	clients map[string]authn.Client

	tracer         tracing.Tracer
	sessionService auth.UserTokenService

	// postAuthHooks are called after a successful authentication. They can modify the identity.
	postAuthHooks []authn.PostAuthHookFn
	// postLoginHooks are called after a login request is performed, both for failing and successful requests.
	postLoginHooks []authn.PostLoginHookFn
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

	// FIXME (kalleep): Handle disabled identities

	for _, hook := range s.postAuthHooks {
		if err := hook(ctx, identity, r); err != nil {
			s.log.FromContext(ctx).Warn("post auth hook failed", "error", err, "id", identity)
			return nil, false, err
		}
	}

	if identity.IsDisabled {
		return nil, true, errDisabledIdentity.Errorf("identity is disabled")
	}

	return identity, true, nil
}

func (s *Service) RegisterPostAuthHook(hook authn.PostAuthHookFn) {
	s.postAuthHooks = append(s.postAuthHooks, hook)
}

func (s *Service) Login(ctx context.Context, client string, r *authn.Request) (identity *authn.Identity, err error) {
	var ok bool
	identity, ok, err = s.Authenticate(ctx, client, r)
	if !ok {
		return nil, authn.ErrClientNotConfigured.Errorf("client not configured: %s", client)
	}

	defer func() {
		for _, hook := range s.postLoginHooks {
			hook(ctx, identity, r, err)
		}
	}()

	if err != nil {
		return nil, err
	}

	namespace, id := identity.NamespacedID()

	// Login is only supported for users
	if namespace != authn.NamespaceUser || id <= 0 {
		return nil, authn.ErrUnsupportedIdentity.Errorf("expected identity of type user but got: %s", namespace)
	}

	addr := web.RemoteAddr(r.HTTPRequest)
	ip, err := network.GetIPFromAddress(addr)
	if err != nil {
		s.log.Debug("failed to parse ip from address", "addr", addr)
	}

	sessionToken, err := s.sessionService.CreateToken(ctx, &user.User{ID: id}, ip, r.HTTPRequest.UserAgent())
	if err != nil {
		return nil, err
	}

	identity.SessionToken = sessionToken
	return identity, nil
}

func (s *Service) RegisterPostLoginHook(hook authn.PostLoginHookFn) {
	s.postLoginHooks = append(s.postLoginHooks, hook)
}

func (s *Service) RedirectURL(ctx context.Context, client string, r *authn.Request) (string, error) {
	ctx, span := s.tracer.Start(ctx, "authn.RedirectURL")
	defer span.End()
	span.SetAttributes(attributeKeyClient, client, attribute.Key(attributeKeyClient).String(client))

	c, ok := s.clients[client]
	if !ok {
		return "", authn.ErrClientNotConfigured.Errorf("client not configured: %s", client)
	}

	redirectClient, ok := c.(authn.RedirectClient)
	if !ok {
		return "", authn.ErrUnsupportedClient.Errorf("client does not support generating redirect url: %s", client)
	}

	return redirectClient.RedirectURL(ctx, r)
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
