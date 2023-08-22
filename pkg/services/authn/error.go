package authn

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrTokenNeedsRotation  = errutil.Unauthorized("session.token.rotate")
	ErrUnsupportedClient   = errutil.BadRequest("auth.client.unsupported")
	ErrClientNotConfigured = errutil.BadRequest("auth.client.notConfigured")
	ErrUnsupportedIdentity = errutil.NotImplemented("auth.identity.unsupported")
	ErrExpiredAccessToken  = errutil.Unauthorized("oauth.expired-token", errutil.WithPublicMessage("OAuth access token expired"))
)
