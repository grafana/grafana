package authn

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

var (
	ErrTokenNeedsRotation  = errutil.Unauthorized("session.token.rotate", errutil.WithLogLevel(errutil.LevelDebug))
	ErrUnsupportedClient   = errutil.BadRequest("auth.client.unsupported")
	ErrClientNotConfigured = errutil.BadRequest("auth.client.notConfigured")
	ErrUnsupportedIdentity = errutil.NotImplemented("auth.identity.unsupported")
	ErrExpiredAccessToken  = errutil.Unauthorized("oauth.expired-token", errutil.WithPublicMessage("OAuth access token expired"))
	// BMC Code: Next Err
	ErrInvalidPermission         = errutil.Unauthorized("missing-reporting-permission")
	ErrRequestForDedicatedTenant = errutil.Internal("dedicated-tenant-request")
)
