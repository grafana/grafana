package serviceauth

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrUnknownProvider    = errutil.BadRequest("serviceauth.unknown-provider")
	ErrInvalidProviderCfg = errutil.BadRequest("serviceauth.invalid-provider-configuration")
)
