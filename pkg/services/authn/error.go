package authn

import "github.com/grafana/grafana/pkg/util/errutil"

var ErrClientNotFound = errutil.NewBase(errutil.StatusNotFound, "auth.client.notConfigured")
