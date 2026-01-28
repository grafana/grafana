package sync

import (
	"context"
	"net"
	"strings"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func ProvideAuthProxySessionSync(cfg *setting.Cfg, sessionService auth.UserTokenService, tracer tracing.Tracer) *AuthProxySessionSync {
	return &AuthProxySessionSync{
		cfg:            cfg,
		sessionService: sessionService,
		log:            log.New("auth_proxy.session.sync"),
		tracer:         tracer,
	}
}

type AuthProxySessionSync struct {
	cfg            *setting.Cfg
	sessionService auth.UserTokenService
	log            log.Logger
	tracer         tracing.Tracer
}

// SyncAuthProxySessionHook creates a session token for auth proxy users when enable_login_token is enabled.
// This hook runs after successful authentication and assigns a session cookie to auth proxy users
// so they don't need to rely on the proxy header for subsequent requests within the session lifetime.
func (s *AuthProxySessionSync) SyncAuthProxySessionHook(ctx context.Context, id *authn.Identity, r *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "auth_proxy.session.sync.SyncAuthProxySessionHook")
	defer span.End()

	// Only proceed if auth proxy is enabled and login token is enabled
	if !s.cfg.AuthProxy.Enabled || !s.cfg.AuthProxy.EnableLoginToken {
		return nil
	}

	// Only process user identities
	if !id.IsIdentityType(claims.TypeUser) {
		return nil
	}

	// Only process auth proxy or LDAP authenticated users (LDAP users can be authenticated via auth proxy)
	authenticatedBy := id.GetAuthenticatedBy()
	if !isAuthProxyOrLDAP(authenticatedBy) {
		return nil
	}

	if id.SessionToken != nil {
		return nil
	}

	userID, err := id.GetInternalID()
	if err != nil {
		s.log.FromContext(ctx).Warn("Failed to get internal user ID for auth proxy session sync", "error", err)
		return nil
	}

	var clientIP net.IP
	if r.HTTPRequest != nil {
		addr := web.RemoteAddr(r.HTTPRequest)
		clientIP, err = network.GetIPFromAddress(addr)
		if err != nil {
			s.log.FromContext(ctx).Debug("Failed to parse IP from address", "addr", addr, "error", err)
		}
	}

	var userAgent string
	if r.HTTPRequest != nil {
		userAgent = r.HTTPRequest.UserAgent()
	}

	token, err := s.sessionService.CreateToken(ctx, &auth.CreateTokenCommand{
		User:      &user.User{ID: userID},
		ClientIP:  clientIP,
		UserAgent: userAgent,
	})
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to create session token for auth proxy user", "userID", userID, "error", err)
		return nil
	}

	id.SessionToken = token
	s.log.FromContext(ctx).Debug("Created session token for auth proxy user", "userID", userID)

	return nil
}

// isAuthProxyOrLDAP checks if the authentication module is auth proxy or LDAP.
// LDAP users authenticated via auth proxy are also included since they may use
// the auth proxy header for initial authentication but want a session token.
func isAuthProxyOrLDAP(authModule string) bool {
	return strings.EqualFold(authModule, login.AuthProxyAuthModule) ||
		strings.EqualFold(authModule, login.LDAPAuthModule)
}
