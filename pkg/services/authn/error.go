package authn

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrTokenNeedsRotation  = errutil.NewBase(errutil.StatusUnauthorized, "session.token.rotate")
	ErrUnsupportedClient   = errutil.NewBase(errutil.StatusBadRequest, "auth.client.unsupported")
	ErrClientNotConfigured = errutil.NewBase(errutil.StatusBadRequest, "auth.client.notConfigured")
	ErrUnsupportedIdentity = errutil.NewBase(errutil.StatusNotImplemented, "auth.identity.unsupported")
)
