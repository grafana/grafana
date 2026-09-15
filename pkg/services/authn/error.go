package authn

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

var (
	ErrUnsupportedClient   = errutil.BadRequest("auth.client.unsupported")
	ErrClientNotConfigured = errutil.BadRequest("auth.client.notConfigured")
	ErrUnsupportedIdentity = errutil.NotImplemented("auth.identity.unsupported")
	ErrExpiredAccessToken  = errutil.Unauthorized("oauth.expired-token", errutil.WithPublicMessage("OAuth access token expired"))
)
