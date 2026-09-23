package authn

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

var (
	errTokenNeedsRotation  = errutil.Unauthorized("session.token.rotate", errutil.WithLogLevel(errutil.LevelDebug))
	ErrUnsupportedClient   = errutil.BadRequest("auth.client.unsupported")
	ErrClientNotConfigured = errutil.BadRequest("auth.client.notConfigured")
	ErrUnsupportedIdentity = errutil.NotImplemented("auth.identity.unsupported")
	ErrExpiredAccessToken  = errutil.Unauthorized("oauth.expired-token", errutil.WithPublicMessage("OAuth access token expired"))
)

type errutilError = errutil.Error

type TokenNeedsRotationError struct {
	errutilError
	UserID int64
}

func NewTokenNeedsRotationError(userID int64) TokenNeedsRotationError {
	return TokenNeedsRotationError{
		errutilError: errTokenNeedsRotation.Errorf("token needs to be rotated"),
		UserID:       userID,
	}
}
