package extsvcauth

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrUnknownProvider     = errutil.BadRequest("extsvcauth.unknown-provider")
	ErrCredentialsNotFound = errutil.NotFound("extsvcauth.credentials-not-found")
)
