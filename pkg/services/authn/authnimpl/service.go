package authnimpl

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/authlib/claims"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
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

// make sure service also implements authn.ServiceAuthenticateOnly interface
func ProvideAuthnServiceAuthenticateOnly(s *Service) authn.Authenticator {
	return s
}

// make sure service implements authn.IdentitySynchronizer interface
func ProvideIdentitySynchronizer(s *Service) authn.IdentitySynchronizer {
	return s
}

func ProvideService(
	cfg *setting.Cfg, tracer tracing.Tracer, sessionService auth.UserTokenService,
	usageStats usagestats.Service, registerer prometheus.Registerer, authTokenService login.AuthInfoService,
) *Service {
	s := &Service{
		log:                    log.New("authn.service"),
		cfg:                    cfg,
		clients:                make(map[string]authn.Client),
		clientQueue:            newQueue[authn.ContextAwareClient](),
		idenityResolverClients: make(map[string]authn.IdentityResolverClient),
		tracer:                 tracer,
		metrics:                newMetrics(registerer),
		sessionService:         sessionService,
		authTokenService:       authTokenService,
		preLogoutHooks:         newQueue[authn.PreLogoutHookFn](),
		postAuthHooks:          newQueue[authn.PostAuthHookFn](),
		postLoginHooks:         newQueue[authn.PostLoginHookFn](),
	}

	usageStats.RegisterMetricsFunc(s.getUsageStats)
	return s
}

type Service struct {
	log log.Logger
	cfg *setting.Cfg

	clients     map[string]authn.Client
	clientQueue *queue[authn.ContextAwareClient]

	idenityResolverClients map[string]authn.IdentityResolverClient

	tracer  tracing.Tracer
	metrics *metrics

	sessionService   auth.UserTokenService
	authTokenService login.AuthInfoService

	// postAuthHooks are called after a successful authentication. They can modify the identity.
	postAuthHooks *queue[authn.PostAuthHookFn]
	// postLoginHooks are called after a login request is performed, both for failing and successful requests.
	postLoginHooks *queue[authn.PostLoginHookFn]
	// preLogoutHooks are called before a logout request is performed.
	preLogoutHooks *queue[authn.PreLogoutHookFn]
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
	ctx, span := s.tracer.Start(ctx, "authn.authenticate")
	defer span.End()

	identity, err := c.Authenticate(ctx, r)
	if err != nil {
		span.SetStatus(codes.Error, "authenticate failed on client")
		span.RecordError(err)
		s.errorLogFunc(ctx, err)("Failed to authenticate request", "client", c.Name(), "error", err)
		return nil, err
	}

	span.SetAttributes(
		attribute.String("identity.ID", identity.GetID()),
		attribute.String("identity.AuthID", identity.GetAuthID()),
		attribute.String("identity.AuthenticatedBy", identity.GetAuthenticatedBy()),
	)

	if len(identity.ClientParams.FetchPermissionsParams.RestrictedActions) > 0 {
		span.SetAttributes(attribute.StringSlice("identity.ClientParams.FetchPermissionsParams.RestrictedActions", identity.ClientParams.FetchPermissionsParams.RestrictedActions))
	}

	if len(identity.ClientParams.FetchPermissionsParams.Roles) > 0 {
		span.SetAttributes(attribute.StringSlice("identity.ClientParams.FetchPermissionsParams.Roles", identity.ClientParams.FetchPermissionsParams.Roles))
	}

	if len(identity.ClientParams.FetchPermissionsParams.AllowedActions) > 0 {
		span.SetAttributes(attribute.StringSlice("identity.ClientParams.FetchPermissionsParams.AllowedActions", identity.ClientParams.FetchPermissionsParams.AllowedActions))
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

	// Login is only supported for users
	if !id.IsIdentityType(claims.TypeUser) {
		s.metrics.failedLogin.WithLabelValues(client).Inc()
		return nil, authn.ErrUnsupportedIdentity.Errorf("expected identity of type user but got: %s", id.GetIdentityType())
	}

	userID, err := id.GetInternalID()
	if err != nil {
		return nil, err
	}

	addr := web.RemoteAddr(r.HTTPRequest)
	ip, err := network.GetIPFromAddress(addr)
	if err != nil {
		s.log.FromContext(ctx).Debug("Failed to parse ip from address", "client", c.Name(), "id", id.ID, "addr", addr, "error", err)
	}

	externalSession := s.resolveExternalSessionFromIdentity(ctx, id, userID)

	sessionToken, err := s.sessionService.CreateToken(ctx, &auth.CreateTokenCommand{User: &user.User{ID: userID}, ClientIP: ip, UserAgent: r.HTTPRequest.UserAgent(), ExternalSession: externalSession})
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

func (s *Service) RegisterPreLogoutHook(hook authn.PreLogoutHookFn, priority uint) {
	s.preLogoutHooks.insert(hook, priority)
}

func (s *Service) Logout(ctx context.Context, user identity.Requester, sessionToken *auth.UserToken) (*authn.Redirect, error) {
	ctx, span := s.tracer.Start(ctx, "authn.Logout")
	defer span.End()

	redirect := &authn.Redirect{URL: s.cfg.AppSubURL + "/login"}
	if s.cfg.SignoutRedirectUrl != "" {
		redirect.URL = s.cfg.SignoutRedirectUrl
	}

	if !user.IsIdentityType(claims.TypeUser) {
		return redirect, nil
	}

	id, err := user.GetInternalID()
	if err != nil {
		s.log.FromContext(ctx).Debug("Invalid user id", "id", id, "err", err)
		return redirect, nil
	}

	for _, hook := range s.preLogoutHooks.items {
		if err := hook.v(ctx, user, sessionToken); err != nil {
			s.log.Error("Failed to run pre logout hook. Skipping...", "error", err)
		}
	}

	if authModule := user.GetAuthenticatedBy(); authModule != "" {
		client := authn.ClientWithPrefix(strings.TrimPrefix(authModule, "oauth_"))

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

		clientRedirect, ok := logoutClient.Logout(ctx, user, sessionToken)
		if !ok {
			goto Default
		}

		redirect = clientRedirect
	}

Default:
	if err = s.sessionService.RevokeToken(ctx, sessionToken, false); err != nil && !errors.Is(err, auth.ErrUserTokenNotFound) {
		return nil, err
	}

	return redirect, nil
}

func (s *Service) ResolveIdentity(ctx context.Context, orgID int64, typedID string) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.ResolveIdentity")
	defer span.End()

	r := &authn.Request{}
	r.OrgID = orgID
	// hack to not update last seen
	r.SetMeta(authn.MetaKeyIsLogin, "true")

	identity, err := s.resolveIdenity(ctx, orgID, typedID)
	if err != nil {
		if errors.Is(err, claims.ErrInvalidTypedID) {
			return nil, authn.ErrUnsupportedIdentity.Errorf("invalid identity type")
		}

		return nil, err
	}

	return s.authenticate(ctx, clients.ProvideIdentity(identity), r)
}

func (s *Service) RegisterClient(c authn.Client) {
	s.clients[c.Name()] = c

	if cac, ok := c.(authn.ContextAwareClient); ok {
		s.clientQueue.insert(cac, cac.Priority())
	}

	if rc, ok := c.(authn.IdentityResolverClient); ok {
		s.idenityResolverClients[rc.IdentityType().String()] = rc
	}
}

func (s *Service) IsClientEnabled(name string) bool {
	client, ok := s.clients[name]
	if !ok {
		return false
	}

	return client.IsEnabled()
}

func (s *Service) GetClientConfig(name string) (authn.SSOClientConfig, bool) {
	client, ok := s.clients[name]
	if !ok {
		return nil, false
	}

	ssoSettingsAwareClient, ok := client.(authn.SSOSettingsAwareClient)
	if !ok {
		return nil, false
	}

	return ssoSettingsAwareClient.GetConfig(), true
}

func (s *Service) SyncIdentity(ctx context.Context, identity *authn.Identity) error {
	ctx, span := s.tracer.Start(ctx, "authn.SyncIdentity")
	defer span.End()

	r := &authn.Request{OrgID: identity.OrgID}
	// hack to not update last seen on external syncs
	r.SetMeta(authn.MetaKeyIsLogin, "true")
	return s.runPostAuthHooks(ctx, identity, r)
}

func (s *Service) resolveIdenity(ctx context.Context, orgID int64, typedID string) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.resolveIdentity")
	defer span.End()

	t, i, err := claims.ParseTypeID(typedID)
	if err != nil {
		return nil, err
	}

	if claims.IsIdentityType(t, claims.TypeUser) {
		return &authn.Identity{
			OrgID: orgID,
			ID:    i,
			Type:  claims.TypeUser,
			ClientParams: authn.ClientParams{
				AllowGlobalOrg:  true,
				FetchSyncedUser: true,
				SyncPermissions: true,
			},
		}, nil
	}

	if claims.IsIdentityType(t, claims.TypeServiceAccount) {
		return &authn.Identity{
			ID:    i,
			Type:  claims.TypeServiceAccount,
			OrgID: orgID,
			ClientParams: authn.ClientParams{
				AllowGlobalOrg:  true,
				FetchSyncedUser: true,
				SyncPermissions: true,
			},
		}, nil
	}

	resolver, ok := s.idenityResolverClients[string(t)]
	if !ok {
		return nil, authn.ErrUnsupportedIdentity.Errorf("no resolver for : %s", t)
	}
	return resolver.ResolveIdentity(ctx, orgID, t, i)
}

func (s *Service) errorLogFunc(ctx context.Context, err error) func(msg string, ctx ...any) {
	if errors.Is(err, context.Canceled) {
		return func(msg string, ctx ...any) {}
	}

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

func (s *Service) resolveExternalSessionFromIdentity(ctx context.Context, identity *authn.Identity, userID int64) *auth.ExternalSession {
	if identity.OAuthToken == nil && identity.SAMLSession == nil {
		return nil
	}

	info, err := s.authTokenService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{AuthId: identity.GetAuthID(), UserId: userID})
	if err != nil {
		s.log.FromContext(ctx).Info("Failed to get auth info", "error", err, "authID", identity.GetAuthID(), "userID", userID)
		return nil
	}

	extSession := &auth.ExternalSession{
		AuthModule: identity.GetAuthenticatedBy(),
		UserAuthID: info.Id,
		UserID:     userID,
	}

	if identity.OAuthToken != nil {
		extSession.AccessToken = identity.OAuthToken.AccessToken
		extSession.RefreshToken = identity.OAuthToken.RefreshToken
		extSession.ExpiresAt = identity.OAuthToken.Expiry

		if idToken, ok := identity.OAuthToken.Extra("id_token").(string); ok && idToken != "" {
			extSession.IDToken = idToken
		}

		// As of https://openid.net/specs/openid-connect-session-1_0.html
		if sessionState, ok := identity.OAuthToken.Extra("session_state").(string); ok && sessionState != "" {
			extSession.SessionID = sessionState
		}

		return extSession
	}

	extSession.SessionID = identity.SAMLSession.SessionIndex
	extSession.NameID = identity.SAMLSession.NameID

	return extSession
}
