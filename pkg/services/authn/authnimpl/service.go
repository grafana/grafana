package authnimpl

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/identity"
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
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/web"
)

const (
	attributeKeyClient = "authn.client"
)

var (
	errCantAuthenticateReq = errutil.Unauthorized("auth.unauthorized")
	errDisabledIdentity    = errutil.Unauthorized("identity.disabled")
)

// make sure service implements authn.Service interface
func ProvideAuthnService(s *Service) authn.Service {
	return s
}

// make sure service implements authn.IdentitySynchronizer interface
func ProvideIdentitySynchronizer(s *Service) authn.IdentitySynchronizer {
	return s
}

func ProvideService(
	cfg *setting.Cfg, tracer tracing.Tracer,
	orgService org.Service, sessionService auth.UserTokenService,
	accessControlService accesscontrol.Service,
	apikeyService apikey.Service, userService user.Service,
	jwtService auth.JWTVerifierService,
	usageStats usagestats.Service,
	userProtectionService login.UserProtectionService,
	loginAttempts loginattempt.Service, quotaService quota.Service,
	authInfoService login.AuthInfoService, renderService rendering.Service,
	features *featuremgmt.FeatureManager, oauthTokenService oauthtoken.OAuthTokenService,
	socialService social.Service, cache *remotecache.RemoteCache,
	ldapService service.LDAP, registerer prometheus.Registerer,
	signingKeysService signingkeys.Service,
	settingsProviderService setting.Provider,
) *Service {
	s := &Service{
		log:             log.New("authn.service"),
		cfg:             cfg,
		clients:         make(map[string]authn.Client),
		clientQueue:     newQueue[authn.ContextAwareClient](),
		tracer:          tracer,
		metrics:         newMetrics(registerer),
		authInfoService: authInfoService,
		sessionService:  sessionService,
		postAuthHooks:   newQueue[authn.PostAuthHookFn](),
		postLoginHooks:  newQueue[authn.PostLoginHookFn](),
	}

	usageStats.RegisterMetricsFunc(s.getUsageStats)

	s.RegisterClient(clients.ProvideRender(userService, renderService))
	s.RegisterClient(clients.ProvideAPIKey(apikeyService, userService))

	if cfg.LoginCookieName != "" {
		s.RegisterClient(clients.ProvideSession(cfg, sessionService))
	}

	var proxyClients []authn.ProxyClient
	var passwordClients []authn.PasswordClient
	if s.cfg.LDAPAuthEnabled {
		ldap := clients.ProvideLDAP(cfg, ldapService, userService, authInfoService)
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

	if s.cfg.AuthProxy.Enabled && len(proxyClients) > 0 {
		proxy, err := clients.ProvideProxy(cfg, cache, proxyClients...)
		if err != nil {
			s.log.Error("Failed to configure auth proxy", "err", err)
		} else {
			s.RegisterClient(proxy)
		}
	}

	if s.cfg.JWTAuth.Enabled {
		s.RegisterClient(clients.ProvideJWT(jwtService, cfg))
	}

	// FIXME (gamab): Commenting that out for now as we want to re-use the client for external service auth
	// if s.cfg.ExtendedJWTAuthEnabled && features.IsEnabledGlobally(featuremgmt.FlagExternalServiceAuth) {
	// 	s.RegisterClient(clients.ProvideExtendedJWT(userService, cfg, signingKeysService, oauthServer))
	// }

	for name := range socialService.GetOAuthProviders() {
		clientName := authn.ClientWithPrefix(name)
		s.RegisterClient(clients.ProvideOAuth(clientName, cfg, oauthTokenService, socialService, settingsProviderService))
	}

	// FIXME (jguer): move to User package
	userSyncService := sync.ProvideUserSync(userService, userProtectionService, authInfoService, quotaService)
	orgUserSyncService := sync.ProvideOrgSync(userService, orgService, accessControlService)
	s.RegisterPostAuthHook(userSyncService.SyncUserHook, 10)
	s.RegisterPostAuthHook(userSyncService.EnableUserHook, 20)
	s.RegisterPostAuthHook(orgUserSyncService.SyncOrgRolesHook, 30)
	s.RegisterPostAuthHook(userSyncService.SyncLastSeenHook, 130)
	s.RegisterPostAuthHook(sync.ProvideOAuthTokenSync(oauthTokenService, sessionService, socialService).SyncOauthTokenHook, 60)
	s.RegisterPostAuthHook(userSyncService.FetchSyncedUserHook, 100)

	rbacSync := sync.ProvideRBACSync(accessControlService)
	if features.IsEnabledGlobally(featuremgmt.FlagCloudRBACRoles) {
		s.RegisterPostAuthHook(rbacSync.SyncCloudRoles, 110)
	}

	s.RegisterPostAuthHook(rbacSync.SyncPermissionsHook, 120)

	return s
}

type Service struct {
	log log.Logger
	cfg *setting.Cfg

	clients     map[string]authn.Client
	clientQueue *queue[authn.ContextAwareClient]

	tracer  tracing.Tracer
	metrics *metrics

	authInfoService login.AuthInfoService
	sessionService  auth.UserTokenService

	// postAuthHooks are called after a successful authentication. They can modify the identity.
	postAuthHooks *queue[authn.PostAuthHookFn]
	// postLoginHooks are called after a login request is performed, both for failing and successful requests.
	postLoginHooks *queue[authn.PostLoginHookFn]
}

func (s *Service) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.Authenticate")
	defer span.End()

	r.OrgID = orgIDFromRequest(r)

	var authErr error
	for _, item := range s.clientQueue.items {
		if item.v.Test(ctx, r) {
			identity, err := s.authenticate(ctx, item.v, r)
			if err != nil {
				// Note: special case for token rotation
				// We don't want to fallthrough in this case
				if errors.Is(err, authn.ErrTokenNeedsRotation) {
					return nil, err
				}

				authErr = errors.Join(authErr, err)
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
	identity, err := c.Authenticate(ctx, r)
	if err != nil {
		s.errorLogFunc(ctx, err)("Failed to authenticate request", "client", c.Name(), "error", err)
		return nil, err
	}

	if err := s.runPostAuthHooks(ctx, identity, r); err != nil {
		s.errorLogFunc(ctx, err)("Failed to run post auth hook", "client", c.Name(), "id", identity.ID, "error", err)
		return nil, err
	}

	if identity.IsDisabled {
		return nil, errDisabledIdentity.Errorf("identity is disabled")
	}

	if hc, ok := c.(authn.HookClient); ok {
		if err := hc.Hook(ctx, identity, r); err != nil {
			s.errorLogFunc(ctx, err)("Failed to run post client auth hook", "client", c.Name(), "id", identity.ID, "error", err)
			return nil, err
		}
	}

	return identity, nil
}

func (s *Service) runPostAuthHooks(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
	for _, hook := range s.postAuthHooks.items {
		if err := hook.v(ctx, identity, r); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) RegisterPostAuthHook(hook authn.PostAuthHookFn, priority uint) {
	s.postAuthHooks.insert(hook, priority)
}

func (s *Service) Login(ctx context.Context, client string, r *authn.Request) (id *authn.Identity, err error) {
	ctx, span := s.tracer.Start(ctx, "authn.Login", trace.WithAttributes(
		attribute.String(attributeKeyClient, client),
	))
	defer span.End()

	r.OrgID = orgIDFromRequest(r)

	defer func() {
		for _, hook := range s.postLoginHooks.items {
			hook.v(ctx, id, r, err)
		}
	}()

	c, ok := s.clients[client]
	if !ok {
		s.metrics.failedLogin.WithLabelValues(client).Inc()
		return nil, authn.ErrClientNotConfigured.Errorf("client not configured: %s", client)
	}

	r.SetMeta(authn.MetaKeyIsLogin, "true")
	id, err = s.authenticate(ctx, c, r)
	if err != nil {
		s.metrics.failedLogin.WithLabelValues(client).Inc()
		return nil, err
	}

	namespace, namespaceID := id.GetNamespacedID()
	// Login is only supported for users
	if namespace != authn.NamespaceUser {
		s.metrics.failedLogin.WithLabelValues(client).Inc()
		return nil, authn.ErrUnsupportedIdentity.Errorf("expected identity of type user but got: %s", namespace)
	}

	intId, err := identity.IntIdentifier(namespace, namespaceID)
	if err != nil {
		return nil, err
	}

	addr := web.RemoteAddr(r.HTTPRequest)
	ip, err := network.GetIPFromAddress(addr)
	if err != nil {
		s.log.FromContext(ctx).Debug("Failed to parse ip from address", "client", c.Name(), "id", id.ID, "addr", addr, "error", err)
	}

	sessionToken, err := s.sessionService.CreateToken(ctx, &user.User{ID: intId}, ip, r.HTTPRequest.UserAgent())
	if err != nil {
		s.metrics.failedLogin.WithLabelValues(client).Inc()
		s.log.FromContext(ctx).Error("Failed to create session", "client", client, "id", id.ID, "err", err)
		return nil, err
	}

	s.metrics.successfulLogin.WithLabelValues(client).Inc()
	id.SessionToken = sessionToken
	return id, nil
}

func (s *Service) RegisterPostLoginHook(hook authn.PostLoginHookFn, priority uint) {
	s.postLoginHooks.insert(hook, priority)
}

func (s *Service) RedirectURL(ctx context.Context, client string, r *authn.Request) (*authn.Redirect, error) {
	ctx, span := s.tracer.Start(ctx, "authn.RedirectURL", trace.WithAttributes(
		attribute.String(attributeKeyClient, client),
	))
	defer span.End()

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

func (s *Service) Logout(ctx context.Context, user identity.Requester, sessionToken *auth.UserToken) (*authn.Redirect, error) {
	ctx, span := s.tracer.Start(ctx, "authn.Logout")
	defer span.End()

	redirect := &authn.Redirect{URL: s.cfg.AppSubURL + "/login"}

	namespace, id := user.GetNamespacedID()
	if namespace != authn.NamespaceUser {
		return redirect, nil
	}

	userID, err := identity.IntIdentifier(namespace, id)
	if err != nil {
		s.log.FromContext(ctx).Debug("Invalid user id", "id", userID, "err", err)
		return redirect, nil
	}

	info, _ := s.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: userID})
	if info != nil {
		client := authn.ClientWithPrefix(strings.TrimPrefix(info.AuthModule, "oauth_"))

		c, ok := s.clients[client]
		if !ok {
			s.log.FromContext(ctx).Debug("No client configured for auth module", "client", client)
			goto Default
		}

		logoutClient, ok := c.(authn.LogoutClient)
		if !ok {
			s.log.FromContext(ctx).Debug("Client do not support specialized logout logic", "client", client)
			goto Default
		}

		clientRedirect, ok := logoutClient.Logout(ctx, user, info)
		if !ok {
			goto Default
		}

		redirect = clientRedirect
	}

Default:
	if err = s.sessionService.RevokeToken(ctx, sessionToken, false); err != nil {
		return nil, err
	}

	return redirect, nil
}

func (s *Service) RegisterClient(c authn.Client) {
	s.clients[c.Name()] = c
	if cac, ok := c.(authn.ContextAwareClient); ok {
		s.clientQueue.insert(cac, cac.Priority())
	}
}

func (s *Service) SyncIdentity(ctx context.Context, identity *authn.Identity) error {
	r := &authn.Request{OrgID: identity.OrgID}
	// hack to not update last seen on external syncs
	r.SetMeta(authn.MetaKeyIsLogin, "true")
	return s.runPostAuthHooks(ctx, identity, r)
}

func (s *Service) errorLogFunc(ctx context.Context, err error) func(msg string, ctx ...any) {
	l := s.log.FromContext(ctx)

	var grfErr errutil.Error
	if errors.As(err, &grfErr) {
		return grfErr.LogLevel.LogFunc(l)
	}

	return l.Warn
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
