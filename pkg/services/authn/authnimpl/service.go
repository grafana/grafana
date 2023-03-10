package authnimpl

import (
	"context"
	"net/http"
	"strconv"

	"github.com/hashicorp/go-multierror"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authnimpl/sync"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ldap/service"
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
	errCantAuthenticateReq = errutil.NewBase(errutil.StatusUnauthorized, "auth.unauthorized")
	errDisabledIdentity    = errutil.NewBase(errutil.StatusUnauthorized, "identity.disabled")
)

// make sure service implements authn.Service interface
var _ authn.Service = new(Service)

func ProvideService(
	cfg *setting.Cfg, tracer tracing.Tracer,
	orgService org.Service, sessionService auth.UserTokenService,
	accessControlService accesscontrol.Service,
	apikeyService apikey.Service, userService user.Service,
	jwtService auth.JWTVerifierService,
	usageStats usagestats.Service,
	anonSessionService anonymous.Service,
	userProtectionService login.UserProtectionService,
	loginAttempts loginattempt.Service, quotaService quota.Service,
	authInfoService login.AuthInfoService, renderService rendering.Service,
	features *featuremgmt.FeatureManager, oauthTokenService oauthtoken.OAuthTokenService,
	socialService social.Service, cache *remotecache.RemoteCache,
	ldapService service.LDAP, registerer prometheus.Registerer,
) *Service {
	s := &Service{
		log:            log.New("authn.service"),
		cfg:            cfg,
		clients:        make(map[string]authn.Client),
		clientQueue:    newQueue[authn.ContextAwareClient](),
		tracer:         tracer,
		metrics:        newMetrics(registerer),
		sessionService: sessionService,
		postAuthHooks:  newQueue[authn.PostAuthHookFn](),
		postLoginHooks: newQueue[authn.PostLoginHookFn](),
	}

	usageStats.RegisterMetricsFunc(s.getUsageStats)

	s.RegisterClient(clients.ProvideRender(userService, renderService))
	s.RegisterClient(clients.ProvideAPIKey(apikeyService, userService))

	if cfg.LoginCookieName != "" {
		s.RegisterClient(clients.ProvideSession(sessionService, userService, cfg))
	}

	if s.cfg.AnonymousEnabled {
		s.RegisterClient(clients.ProvideAnonymous(cfg, orgService, anonSessionService))
	}

	var proxyClients []authn.ProxyClient
	var passwordClients []authn.PasswordClient
	if s.cfg.LDAPEnabled {
		ldap := clients.ProvideLDAP(cfg, ldapService)
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
			s.RegisterClient(clients.ProvideBasic(passwordClient))
		}

		if !s.cfg.DisableLoginForm {
			s.RegisterClient(clients.ProvideForm(passwordClient))
		}
	}

	if s.cfg.AuthProxyEnabled && len(proxyClients) > 0 {
		proxy, err := clients.ProvideProxy(cfg, cache, userService, proxyClients...)
		if err != nil {
			s.log.Error("Failed to configure auth proxy", "err", err)
		} else {
			s.RegisterClient(proxy)
		}
	}

	if s.cfg.JWTAuthEnabled {
		s.RegisterClient(clients.ProvideJWT(jwtService, cfg))
	}

	for name := range socialService.GetOAuthProviders() {
		oauthCfg := socialService.GetOAuthInfoProvider(name)
		if oauthCfg != nil && oauthCfg.Enabled {
			clientName := authn.ClientWithPrefix(name)

			connector, errConnector := socialService.GetConnector(name)
			httpClient, errHTTPClient := socialService.GetOAuthHttpClient(name)
			if errConnector != nil || errHTTPClient != nil {
				s.log.Error("Failed to configure oauth client", "client", clientName, "err", multierror.Append(errConnector, errHTTPClient))
			} else {
				s.RegisterClient(clients.ProvideOAuth(clientName, cfg, oauthCfg, connector, httpClient))
			}
		}
	}

	// FIXME (jguer): move to User package
	userSyncService := sync.ProvideUserSync(userService, userProtectionService, authInfoService, quotaService)
	orgUserSyncService := sync.ProvideOrgSync(userService, orgService, accessControlService)
	s.RegisterPostAuthHook(userSyncService.SyncUserHook, 10)
	s.RegisterPostAuthHook(userSyncService.EnableDisabledUserHook, 20)
	s.RegisterPostAuthHook(orgUserSyncService.SyncOrgRolesHook, 30)
	s.RegisterPostAuthHook(userSyncService.SyncLastSeenHook, 40)

	if features.IsEnabled(featuremgmt.FlagAccessTokenExpirationCheck) {
		s.RegisterPostAuthHook(sync.ProvideOAuthTokenSync(oauthTokenService, sessionService).SyncOauthTokenHook, 60)
	}

	s.RegisterPostAuthHook(userSyncService.FetchSyncedUserHook, 100)
	s.RegisterPostAuthHook(sync.ProvidePermissionsSync(accessControlService).SyncPermissionsHook, 110)

	return s
}

type Service struct {
	log log.Logger
	cfg *setting.Cfg

	clients     map[string]authn.Client
	clientQueue *queue[authn.ContextAwareClient]

	tracer  tracing.Tracer
	metrics *metrics

	sessionService auth.UserTokenService

	// postAuthHooks are called after a successful authentication. They can modify the identity.
	postAuthHooks *queue[authn.PostAuthHookFn]
	// postLoginHooks are called after a login request is performed, both for failing and successful requests.
	postLoginHooks *queue[authn.PostLoginHookFn]
}

func (s *Service) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.Authenticate")
	defer span.End()

	var authErr error
	for _, item := range s.clientQueue.items {
		if item.v.Test(ctx, r) {
			identity, err := s.authenticate(ctx, item.v, r)
			if err != nil {
				authErr = multierror.Append(authErr, err)
				// try next
				continue
			}

			if identity != nil {
				s.metrics.successfulAuth.WithLabelValues(item.v.Name()).Inc()
				return identity, nil
			}
		}
	}

	if authErr != nil {
		s.metrics.failedAuth.Inc()
		return nil, authErr
	}

	return nil, errCantAuthenticateReq.Errorf("cannot authenticate request")
}

func (s *Service) authenticate(ctx context.Context, c authn.Client, r *authn.Request) (*authn.Identity, error) {
	r.OrgID = orgIDFromRequest(r)
	identity, err := c.Authenticate(ctx, r)
	if err != nil {
		s.log.FromContext(ctx).Warn("Failed to authenticate request", "client", c.Name(), "error", err)
		return nil, err
	}

	for _, hook := range s.postAuthHooks.items {
		if err := hook.v(ctx, identity, r); err != nil {
			s.log.FromContext(ctx).Warn("Failed to run post auth hook", "client", c.Name(), "id", identity.ID, "error", err)
			return nil, err
		}
	}

	if identity.IsDisabled {
		return nil, errDisabledIdentity.Errorf("identity is disabled")
	}

	if hc, ok := c.(authn.HookClient); ok {
		if err := hc.Hook(ctx, identity, r); err != nil {
			s.log.FromContext(ctx).Warn("Failed to run post client auth hook", "client", c.Name(), "id", identity.ID, "error", err)
			return nil, err
		}
	}

	return identity, nil
}

func (s *Service) RegisterPostAuthHook(hook authn.PostAuthHookFn, priority uint) {
	s.postAuthHooks.insert(hook, priority)
}

func (s *Service) Login(ctx context.Context, client string, r *authn.Request) (identity *authn.Identity, err error) {
	ctx, span := s.tracer.Start(ctx, "authn.Login")
	defer span.End()
	span.SetAttributes(attributeKeyClient, client, attribute.Key(attributeKeyClient).String(client))

	defer func() {
		for _, hook := range s.postLoginHooks.items {
			hook.v(ctx, identity, r, err)
		}
	}()

	c, ok := s.clients[client]
	if !ok {
		s.metrics.failedLogin.WithLabelValues(client).Inc()
		return nil, authn.ErrClientNotConfigured.Errorf("client not configured: %s", client)
	}

	identity, err = s.authenticate(ctx, c, r)
	if err != nil {
		s.metrics.failedLogin.WithLabelValues(client).Inc()
		return nil, err
	}

	namespace, id := identity.NamespacedID()

	// Login is only supported for users
	if namespace != authn.NamespaceUser || id <= 0 {
		s.metrics.failedLogin.WithLabelValues(client).Inc()
		return nil, authn.ErrUnsupportedIdentity.Errorf("expected identity of type user but got: %s", namespace)
	}

	addr := web.RemoteAddr(r.HTTPRequest)
	ip, err := network.GetIPFromAddress(addr)
	if err != nil {
		s.log.FromContext(ctx).Debug("Failed to parse ip from address", "client", c.Name(), "id", identity.ID, "addr", addr, "error", err)
	}

	sessionToken, err := s.sessionService.CreateToken(ctx, &user.User{ID: id}, ip, r.HTTPRequest.UserAgent())
	if err != nil {
		s.metrics.failedLogin.WithLabelValues(client).Inc()
		s.log.FromContext(ctx).Error("Failed to create session", "client", client, "id", identity.ID, "err", err)
		return nil, err
	}

	s.metrics.successfulLogin.WithLabelValues(client).Inc()
	identity.SessionToken = sessionToken
	return identity, nil
}

func (s *Service) RegisterPostLoginHook(hook authn.PostLoginHookFn, priority uint) {
	s.postLoginHooks.insert(hook, priority)
}

func (s *Service) RedirectURL(ctx context.Context, client string, r *authn.Request) (*authn.Redirect, error) {
	ctx, span := s.tracer.Start(ctx, "authn.RedirectURL")
	defer span.End()
	span.SetAttributes(attributeKeyClient, client, attribute.Key(attributeKeyClient).String(client))

	c, ok := s.clients[client]
	if !ok {
		return nil, authn.ErrClientNotConfigured.Errorf("client not configured: %s", client)
	}

	redirectClient, ok := c.(authn.RedirectClient)
	if !ok {
		return nil, authn.ErrUnsupportedClient.Errorf("client does not support generating redirect url: %s", client)
	}

	return redirectClient.RedirectURL(ctx, r)
}

func (s *Service) RegisterClient(c authn.Client) {
	s.clients[c.Name()] = c
	if cac, ok := c.(authn.ContextAwareClient); ok {
		s.clientQueue.insert(cac, cac.Priority())
	}
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
