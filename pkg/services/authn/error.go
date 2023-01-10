package authn

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrClientNotConfigured = errutil.NewBase(errutil.StatusBadRequest, "auth.client.notConfigured")
	ErrUnsupportedIdentity = errutil.NewBase(errutil.StatusNotImplemented, "auth.identity.unsupported")
)
