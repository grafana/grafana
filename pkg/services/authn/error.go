package authn

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

var (
	ErrUnsupportedClient   = errutil.BadRequest("auth.client.unsupported")
	ErrClientNotConfigured = errutil.BadRequest("auth.client.notConfigured")
	ErrUnsupportedIdentity = errutil.NotImplemented("auth.identity.unsupported")
	ErrExpiredAccessToken  = errutil.Unauthorized("oauth.expired-token", errutil.WithPublicMessage("OAuth access token expired"))
)

type ErrTokenNeedsRotation struct {
	UserID int64
}

func (e ErrTokenNeedsRotation) Error() string {
	return "token needs to be rotated"
}

func (e ErrTokenNeedsRotation) Is(target error) bool {
	_, ok := target.(ErrTokenNeedsRotation)
	return ok
}
