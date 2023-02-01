package authn

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrUnsupportedClient   = errutil.NewBase(errutil.StatusBadRequest, "auth.client.unsupported")
	ErrClientNotConfigured = errutil.NewBase(errutil.StatusBadRequest, "auth.client.notConfigured")
	ErrUnsupportedIdentity = errutil.NewBase(errutil.StatusNotImplemented, "auth.identity.unsupported")
)
